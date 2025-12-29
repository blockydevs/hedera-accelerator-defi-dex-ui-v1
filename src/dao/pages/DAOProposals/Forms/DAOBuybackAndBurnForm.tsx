import { useEffect, useState, useCallback } from "react";
import {
  Flex,
  Text,
  Box,
  Select,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  InputGroup,
  InputRightAddon,
  Switch,
  Spinner,
} from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { CreateDAODexSettingsForm } from "../types";
import { DexService } from "@dex/services";
import { ContractId } from "@hashgraph/sdk";
import { SINGLE_DAO_DEX_SETTINGS } from "@dao/config/singleDao";
import { ContractInterface, ethers } from "ethers";
import { TokenId } from "@hashgraph/sdk";
import { solidityAddressToTokenIdString } from "@shared/utils";
import { SINGLE_DAO_ID } from "@dao/config/singleDao";
import { useDAOs, useFetchContract } from "@dao/hooks";

const DEFAULT_DEADLINE_OFFSET_SEC = Number(import.meta.env.VITE_BUYBACK_DEADLINE_OFFSET_SEC || 3600);
const AVG_BLOCK_TIME = Number(import.meta.env.VITE_AVG_BLOCK_TIME || 2);
const USDC_TOKEN_ID = import.meta.env.VITE_USDC_TOKEN_ID || "0.0.456858";
const SAUCERSWAP_API_URL = import.meta.env.VITE_SAUCERSWAP_API_URL || "https://test-api.saucerswap.finance";
const SAUCERSWAP_API_KEY = import.meta.env.VITE_SAUCERSWAP_API_KEY || "";
const DEFAULT_FEE = 3000;

interface SaucerswapPool {
  id: number;
  fee: string;
  tokenA: { id: string; symbol: string };
  tokenB: { id: string; symbol: string };
}

function shortenAddress(address: string, startLength: number = 6, endLength: number = 4) {
  const addr = address.trim();
  if (addr.length <= startLength + endLength) return addr;
  const start = addr.slice(0, startLength);
  const end = addr.slice(-endLength);
  return `${start}...${end}`;
}

function strip0x(value: string): string {
  return value.replace(/^0x/i, "");
}

function solidityAddressToTokenId(solAddress: string): string | null {
  try {
    const result = solidityAddressToTokenIdString(solAddress);
    return result || null;
  } catch {
    return null;
  }
}

function buildPath(tokenIn: string, tokenOut: string, feeHex: string): string {
  return `0x${strip0x(tokenIn)}${feeHex}${strip0x(tokenOut)}`;
}

async function getTokenIdFromAddress(address: string): Promise<string> {
  const v = (address || "").trim();
  if (!v) return "";
  if (v.match(/^\d+\.\d+\.\d+$/)) {
    return v;
  }
  if ((ethers as any)?.utils?.isAddress?.(v)) {
    const result = solidityAddressToTokenId(v);
    if (result) return result;
  }
  return v;
}

function normalizeToSolidityAddress(input: string): string {
  const v = (input || "").trim();
  if (!v) return "";
  if ((ethers as any)?.utils?.isAddress?.(v)) return v;
  try {
    return TokenId.fromString(v).toSolidityAddress();
  } catch {
    return v;
  }
}

async function getPoolFeeHex(tokenInAddress: string, tokenOutAddress: string): Promise<string | null> {
  try {
    const [tokenInId, tokenOutId] = await Promise.all([
      getTokenIdFromAddress(tokenInAddress),
      getTokenIdFromAddress(tokenOutAddress),
    ]);

    if (!tokenInId || !tokenOutId) {
      console.warn("Could not resolve token IDs for fee lookup");
      return null;
    }

    const url = `${SAUCERSWAP_API_URL}/v2/pools`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (SAUCERSWAP_API_KEY) {
      headers["x-api-key"] = SAUCERSWAP_API_KEY;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Saucerswap API error: ${response.status}`);
      return null;
    }

    const pools: SaucerswapPool[] = await response.json();

    const pool = pools.find(
      (p) =>
        (p.tokenA.id === tokenInId && p.tokenB.id === tokenOutId) ||
        (p.tokenA.id === tokenOutId && p.tokenB.id === tokenInId)
    );

    if (!pool) {
      console.warn(`Saucerswap: Pool not found for pair ${tokenInId}/${tokenOutId}`);
      return null;
    }

    const feeNumber = Number(pool.fee);
    if (!Number.isFinite(feeNumber) || feeNumber < 0) {
      console.warn(`Saucerswap: Invalid fee value for pool ${pool.id}: ${pool.fee}`);
      return null;
    }

    return feeNumber.toString(16).padStart(6, "0");
  } catch (error) {
    console.warn("Saucerswap: Failed to fetch pool fee", error);
    return null;
  }
}

interface SaucerswapTokenInfo {
  decimals: number;
  symbol?: string;
}

async function getTokenInfoFromSaucerswap(solAddress: string): Promise<SaucerswapTokenInfo> {
  try {
    const tokenId = solidityAddressToTokenId(solAddress);
    if (!tokenId || tokenId === "0.0.0") {
      return { decimals: 8 };
    }

    const url = `${SAUCERSWAP_API_URL}/tokens/${tokenId}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (SAUCERSWAP_API_KEY) {
      headers["x-api-key"] = SAUCERSWAP_API_KEY;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Saucerswap API error fetching token info: ${response.status}`);
      return { decimals: 8 };
    }

    const data = await response.json();
    return {
      decimals: data?.decimals ?? 8,
      symbol: data?.symbol,
    };
  } catch (error) {
    console.error(`Failed to fetch token info for ${solAddress}`, error);
    return { decimals: 8 };
  }
}

interface TokenOption {
  address: string;
  symbol?: string;
  decimals?: number;
}

export function DAOBuybackAndBurnForm() {
  const daos = useDAOs();
  const daoAccountIdQueryResults = useFetchContract(SINGLE_DAO_ID)!;
  const foundDao: { votingDelay: number; votingPeriod: number } = daos?.data?.find(
    (d) => d.accountEVMAddress.toLowerCase() === daoAccountIdQueryResults?.data?.data.evm_address.toLowerCase()
  ) as { votingDelay: number; votingPeriod: number };

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<CreateDAODexSettingsForm>();

  const [availableTokens, setAvailableTokens] = useState<TokenOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
  const [quoteTokenAddress, setQuoteTokenAddress] = useState<string>("");
  const [quoteTokenDecimals, setQuoteTokenDecimals] = useState<number>(6); // USDC default

  // Fee state
  const [poolFeeHex, setPoolFeeHex] = useState<string | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);

  // Slippage modes
  const [usePercentMinQuoteOut, setUsePercentMinQuoteOut] = useState(true);
  const [minQuoteOutPercent, setMinQuoteOutPercent] = useState<string>("95");
  const [usePercentMinAmountOut, setUsePercentMinAmountOut] = useState(true);
  const [minAmountOutPercent, setMinAmountOutPercent] = useState<string>("95");

  // Max HTK price in dollars (up to 6 decimals)
  const [maxHtkPriceDollars, setMaxHtkPriceDollars] = useState<string>("");

  const [governanceValues, setGovernanceValues] = useState({
    votingDelay: 0,
    votingPeriod: 0,
    timelockMinDelay: 0,
  });

  const amountIn = watch("buybackAndBurnData.amountIn");

  // Load available tokens from pairWhitelist
  useEffect(() => {
    let ignore = false;
    async function loadTokens() {
      try {
        setLoading(true);
        setError(null);
        const cfg = SINGLE_DAO_DEX_SETTINGS?.pairWhitelist;
        const tokens: TokenOption[] = [];
        const seenAddresses = new Set<string>();

        try {
          const address = ContractId.fromString(cfg?.contractId as string).toSolidityAddress();
          const { JsonRpcSigner } = DexService.getJsonRpcProviderAndSigner();
          const contract = new ethers.Contract(address, cfg?.abi as ContractInterface, JsonRpcSigner);
          const method = cfg?.methods?.getPairs || "getAllWhitelistedPairs";
          const res = await contract[method]();

          if (Array.isArray(res)) {
            for (const item of res) {
              try {
                const tokenIn =
                  typeof item?.tokenIn === "string" ? item.tokenIn : Array.isArray(item) ? item[0] : undefined;
                const tokenOut =
                  typeof item?.tokenOut === "string" ? item.tokenOut : Array.isArray(item) ? item[0] : undefined;

                if (typeof tokenIn === "string" && !seenAddresses.has(tokenIn.toLowerCase())) {
                  seenAddresses.add(tokenIn.toLowerCase());

                  const tokenInfo: TokenOption = { address: tokenIn };
                  try {
                    const saucerswapData = await getTokenInfoFromSaucerswap(tokenIn);
                    tokenInfo.decimals = saucerswapData.decimals;
                    if (saucerswapData.symbol) {
                      tokenInfo.symbol = saucerswapData.symbol;
                    }
                  } catch {
                    /* ignore */
                  }
                  tokens.push(tokenInfo);
                }

                if (typeof tokenOut === "string" && !seenAddresses.has(tokenOut.toLowerCase())) {
                  seenAddresses.add(tokenOut.toLowerCase());

                  const tokenInfo: TokenOption = { address: tokenOut };
                  try {
                    const saucerswapData = await getTokenInfoFromSaucerswap(tokenOut);
                    tokenInfo.decimals = saucerswapData.decimals;
                    if (saucerswapData.symbol) {
                      tokenInfo.symbol = saucerswapData.symbol;
                    }
                  } catch {
                    /* ignore */
                  }
                  tokens.push(tokenInfo);
                }
              } catch {
                /* ignore */
              }
            }
          }
        } catch (e) {
          console.error("Failed to load pairs:", e);
        }

        if (!ignore) setAvailableTokens(tokens);
      } catch (e: any) {
        if (!ignore) setError(e?.message ?? "Failed to fetch available tokens");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadTokens();
    return () => {
      ignore = true;
    };
  }, []);

  // Load quote token address
  useEffect(() => {
    async function loadQuoteToken() {
      try {
        const quoteAddr = normalizeToSolidityAddress(USDC_TOKEN_ID);
        setQuoteTokenAddress(quoteAddr);

        try {
          const saucerswapData = await getTokenInfoFromSaucerswap(quoteAddr);
          if (saucerswapData.decimals) {
            setQuoteTokenDecimals(saucerswapData.decimals);
          }
        } catch {
          setQuoteTokenDecimals(6);
        }
      } catch {
        // ignore
      }
    }
    loadQuoteToken();
  }, []);

  useEffect(() => {
    async function fetchGovernanceDetails() {
      try {
        setGovernanceValues({
          votingDelay: foundDao.votingDelay,
          votingPeriod: foundDao.votingPeriod,
          timelockMinDelay: 0,
        });
      } catch (e) {
        console.error("Failed to fetch governance details", e);
      }
    }
    fetchGovernanceDetails();
  }, []);

  useEffect(() => {
    if (!selectedToken || !quoteTokenAddress) {
      setPoolFeeHex(null);
      return;
    }

    let ignore = false;
    async function fetchFee() {
      setFeeLoading(true);
      setFeeError(null);
      try {
        const tokenInAddr = normalizeToSolidityAddress(selectedToken?.address || "0x");
        const feeHex = await getPoolFeeHex(tokenInAddr, quoteTokenAddress);

        if (!ignore) {
          if (feeHex) {
            setPoolFeeHex(feeHex);
            setFeeError(null);
          } else {
            setPoolFeeHex(DEFAULT_FEE.toString(16).padStart(6, "0"));
            setFeeError("Pool not found - using default fee (0.3%)");
          }
        }
      } catch (e: any) {
        if (!ignore) {
          setPoolFeeHex(DEFAULT_FEE.toString(16).padStart(6, "0"));
          setFeeError(`Failed to fetch fee: ${e?.message || "Unknown error"} - using default`);
        }
      } finally {
        if (!ignore) setFeeLoading(false);
      }
    }
    fetchFee();
    return () => {
      ignore = true;
    };
  }, [selectedToken, quoteTokenAddress]);

  useEffect(() => {
    if (selectedToken && quoteTokenAddress && poolFeeHex) {
      const tokenInAddr = normalizeToSolidityAddress(selectedToken.address);
      const path = buildPath(tokenInAddr, quoteTokenAddress, poolFeeHex);
      setValue("buybackAndBurnData.pathToQuote", path);
      setValue("buybackAndBurnData.tokenIn", tokenInAddr);
    }
  }, [selectedToken, quoteTokenAddress, poolFeeHex, setValue]);

  useEffect(() => {
    const { votingDelay, votingPeriod, timelockMinDelay } = governanceValues;
    const nowSec = Math.floor(Date.now() / 1000);
    const calculatedOffset =
      (votingDelay + votingPeriod) * AVG_BLOCK_TIME + timelockMinDelay + DEFAULT_DEADLINE_OFFSET_SEC;
    const deadline = (nowSec + calculatedOffset).toString();
    setValue("buybackAndBurnData.deadline", deadline);
  }, [setValue, governanceValues]);

  const handleMinQuoteOutPercentChange = useCallback(
    (percentValue: string) => {
      setMinQuoteOutPercent(percentValue);
      if (usePercentMinQuoteOut && amountIn && selectedToken?.decimals !== undefined) {
        const percent = parseFloat(percentValue) || 0;
        const amountInNum = parseFloat(amountIn) || 0;
        const minOut = (amountInNum * percent) / 100;
        const minOutScaled = Math.floor(minOut * Math.pow(10, quoteTokenDecimals - (selectedToken?.decimals || 0)));
        setValue("buybackAndBurnData.minQuoteOut", minOutScaled > 0 ? minOutScaled.toString() : "0");
      }
    },
    [usePercentMinQuoteOut, amountIn, selectedToken, quoteTokenDecimals, setValue]
  );

  const handleMinAmountOutPercentChange = useCallback(
    (percentValue: string) => {
      setMinAmountOutPercent(percentValue);
      if (usePercentMinAmountOut && amountIn && selectedToken?.decimals !== undefined) {
        const percent = parseFloat(percentValue) || 0;
        const amountInNum = parseFloat(amountIn) || 0;
        const minOut = (amountInNum * percent) / 100;
        const minOutScaled = Math.floor(minOut);
        setValue("buybackAndBurnData.minAmountOut", minOutScaled > 0 ? minOutScaled.toString() : "0");
      }
    },
    [usePercentMinAmountOut, amountIn, selectedToken, setValue]
  );

  useEffect(() => {
    if (usePercentMinQuoteOut && amountIn && selectedToken?.decimals !== undefined) {
      const percent = parseFloat(minQuoteOutPercent) || 0;
      const amountInNum = parseFloat(amountIn) || 0;
      const minOut = (amountInNum * percent) / 100;
      const minOutScaled = Math.floor(minOut * Math.pow(10, quoteTokenDecimals - (selectedToken?.decimals || 0)));
      setValue("buybackAndBurnData.minQuoteOut", minOutScaled > 0 ? minOutScaled.toString() : "0");
    }
  }, [usePercentMinQuoteOut, amountIn, selectedToken, quoteTokenDecimals, minQuoteOutPercent, setValue]);

  useEffect(() => {
    if (usePercentMinAmountOut && amountIn && selectedToken?.decimals !== undefined) {
      const percent = parseFloat(minAmountOutPercent) || 0;
      const amountInNum = parseFloat(amountIn) || 0;
      const minOut = (amountInNum * percent) / 100;
      const minOutScaled = Math.floor(minOut);
      setValue("buybackAndBurnData.minAmountOut", minOutScaled > 0 ? minOutScaled.toString() : "0");
    }
  }, [usePercentMinAmountOut, amountIn, selectedToken, minAmountOutPercent, setValue]);

  const handleMaxHtkPriceChange = useCallback(
    (dollarValue: string) => {
      setMaxHtkPriceDollars(dollarValue);
      const dollars = parseFloat(dollarValue) || 0;
      if (dollars > 0) {
        const priceD18 = ethers.utils.parseUnits(dollarValue, 18);
        setValue("buybackAndBurnData.maxHtkPriceD18", priceD18.toString());
      } else {
        setValue("buybackAndBurnData.maxHtkPriceD18", ethers.constants.MaxUint256.toString());
      }
    },
    [setValue]
  );

  const handleTokenSelect = useCallback(
    (address: string) => {
      const token = availableTokens.find((t) => t.address === address);
      setSelectedToken(token || null);
      if (token) {
        setValue("buybackAndBurnData.tokenIn", normalizeToSolidityAddress(token.address));
      }
    },
    [availableTokens, setValue]
  );

  const getFeeDisplayValue = (): string => {
    if (feeLoading) return "Loading...";
    if (!poolFeeHex) return "N/A";
    const feeNum = parseInt(poolFeeHex, 16);
    const feePercent = feeNum / 10000;
    return `${feePercent}% (${feeNum})`;
  };

  return (
    <Flex direction="column" gap="1.3rem">
      <Text fontWeight="bold">Buyback and Burn Configuration</Text>
      {loading && <Text color="gray.500">Loading available tokens…</Text>}
      {error && <Text color="red.400">{error}</Text>}
      <Box>
        <FormControl>
          <FormLabel fontWeight="semibold">Token to Sell</FormLabel>
          <Select
            placeholder="Select a token"
            onChange={(e) => handleTokenSelect(e.target.value)}
            value={selectedToken?.address || ""}
          >
            {availableTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol ? `${token.symbol} (${shortenAddress(token.address)})` : shortenAddress(token.address)}
                {token.decimals !== undefined && ` - ${token.decimals} decimals`}
              </option>
            ))}
          </Select>
          <FormHelperText>
            Select the token you want to sell for buyback. Tokens are loaded from the pair whitelist smart contract.
          </FormHelperText>
        </FormControl>
      </Box>

      {selectedToken && (
        <>
          <Box bg="gray.50" p={3} borderRadius="md">
            <Text fontSize="sm" color="gray.600">
              Selected Token: <strong>{selectedToken.symbol || shortenAddress(selectedToken.address)}</strong>
              <br />
              Decimals: <strong>{selectedToken.decimals ?? "Unknown"}</strong>
              <br />
              Address: <code>{selectedToken.address}</code>
            </Text>
          </Box>

          <Box bg={feeError ? "yellow.50" : "blue.50"} p={3} borderRadius="md">
            <Flex align="center" gap={2}>
              <Text fontSize="sm" color={feeError ? "yellow.700" : "blue.700"}>
                <strong>Pool Fee:</strong> {feeLoading ? <Spinner size="xs" /> : getFeeDisplayValue()}
              </Text>
            </Flex>
            {feeError && (
              <Text fontSize="xs" color="yellow.600" mt={1}>
                ⚠️ {feeError}
              </Text>
            )}
            <Text fontSize="xs" color="gray.500" mt={1}>
              Fee is fetched from Saucerswap V2 pools for the {selectedToken.symbol || "selected token"} → USDC pair.
            </Text>
          </Box>

          <Box>
            <FormControl>
              <FormLabel fontWeight="semibold">Amount In (raw units)</FormLabel>
              <Input
                type="text"
                placeholder={`Enter amount in raw units${
                  selectedToken.decimals !== undefined ? ` (${selectedToken.decimals} decimals)` : ""
                }`}
                {...register("buybackAndBurnData.amountIn", {
                  required: "Amount is required",
                  validate: (v) => {
                    const num = parseFloat(v || "");
                    if (isNaN(num) || num <= 0) return "Amount must be greater than 0";
                    return true;
                  },
                })}
              />
              <FormHelperText>
                {selectedToken.decimals !== undefined && (
                  <>
                    This token has <strong>{selectedToken.decimals}</strong> decimals. For example, to send 1 token,
                    enter: <code>{Math.pow(10, selectedToken.decimals)}</code>
                  </>
                )}
              </FormHelperText>
              {(errors as any)?.buybackAndBurnData?.amountIn && (
                <Text color="red.500" fontSize="sm">
                  {(errors as any).buybackAndBurnData.amountIn.message}
                </Text>
              )}
            </FormControl>
          </Box>

          <Box>
            <FormControl>
              <Flex justify="space-between" align="center" mb={2}>
                <FormLabel fontWeight="semibold" mb={0}>
                  Minimum Quote Out
                </FormLabel>
                <Flex align="center" gap={2}>
                  <Text fontSize="sm">Use %</Text>
                  <Switch
                    isChecked={usePercentMinQuoteOut}
                    onChange={(e) => setUsePercentMinQuoteOut(e.target.checked)}
                  />
                </Flex>
              </Flex>
              {usePercentMinQuoteOut ? (
                <InputGroup>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={minQuoteOutPercent}
                    onChange={(e) => handleMinQuoteOutPercentChange(e.target.value)}
                  />
                  <InputRightAddon>%</InputRightAddon>
                </InputGroup>
              ) : (
                <Input
                  type="text"
                  placeholder={`Enter minimum quote output (${quoteTokenDecimals} decimals)`}
                  {...register("buybackAndBurnData.minQuoteOut", {
                    required: "Min quote out is required",
                    validate: (v) => {
                      const num = parseFloat(v || "");
                      if (isNaN(num) || num < 0) return "Value must be non-negative";
                      return true;
                    },
                  })}
                />
              )}
              <FormHelperText>
                Minimum amount of quote token (USDC) to receive from the first swap.
                {usePercentMinQuoteOut && " Calculated as percentage of amountIn."}
              </FormHelperText>
              {(errors as any)?.buybackAndBurnData?.minQuoteOut && (
                <Text color="red.500" fontSize="sm">
                  {(errors as any).buybackAndBurnData.minQuoteOut.message}
                </Text>
              )}
            </FormControl>
          </Box>

          <Box>
            <FormControl>
              <Flex justify="space-between" align="center" mb={2}>
                <FormLabel fontWeight="semibold" mb={0}>
                  Minimum KAI Out
                </FormLabel>
                <Flex align="center" gap={2}>
                  <Text fontSize="sm">Use %</Text>
                  <Switch
                    isChecked={usePercentMinAmountOut}
                    onChange={(e) => setUsePercentMinAmountOut(e.target.checked)}
                  />
                </Flex>
              </Flex>
              {usePercentMinAmountOut ? (
                <InputGroup>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={minAmountOutPercent}
                    onChange={(e) => handleMinAmountOutPercentChange(e.target.value)}
                  />
                  <InputRightAddon>%</InputRightAddon>
                </InputGroup>
              ) : (
                <Input
                  type="text"
                  placeholder="Enter minimum KAI output (raw units)"
                  {...register("buybackAndBurnData.minAmountOut", {
                    required: "Min amount out is required",
                    validate: (v) => {
                      const num = parseFloat(v || "");
                      if (isNaN(num) || num < 0) return "Value must be non-negative";
                      return true;
                    },
                  })}
                />
              )}
              <FormHelperText>
                Minimum amount of KAI tokens to receive from the final swap.
                {usePercentMinAmountOut && " Calculated as percentage of expected output."}
              </FormHelperText>
              {(errors as any)?.buybackAndBurnData?.minAmountOut && (
                <Text color="red.500" fontSize="sm">
                  {(errors as any).buybackAndBurnData.minAmountOut.message}
                </Text>
              )}
            </FormControl>
          </Box>

          <Box>
            <FormControl>
              <FormLabel fontWeight="semibold">Maximum KAI Price (in dollars)</FormLabel>
              <InputGroup>
                <Input
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="e.g., 0.50"
                  value={maxHtkPriceDollars}
                  onChange={(e) => handleMaxHtkPriceChange(e.target.value)}
                />
                <InputRightAddon>USD</InputRightAddon>
              </InputGroup>
              <FormHelperText>
                Maximum price you are willing to pay per KAI token in dollars (up to 6 decimals). Leave empty or 0 for
                no limit.
              </FormHelperText>
            </FormControl>
          </Box>
        </>
      )}
    </Flex>
  );
}
