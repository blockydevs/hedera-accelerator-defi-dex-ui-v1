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
  Badge,
} from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { CreateDAODexSettingsForm } from "../types";
import { DexService } from "@dex/services";
import { ContractId } from "@hashgraph/sdk";
import { SINGLE_DAO_DEX_SETTINGS } from "@dao/config/singleDao";
import { ContractInterface, ethers } from "ethers";
import { TokenId } from "@hashgraph/sdk";
import BigNumber from "bignumber.js";
import { solidityAddressToTokenIdString } from "@shared/utils";
import { SINGLE_DAO_ID } from "@dao/config/singleDao";
import { useDAOs, useFetchContract } from "@dao/hooks";
import { GovernanceDAODetails } from "@dao/services/types";

const DEFAULT_DEADLINE_OFFSET_SEC = Number(import.meta.env.VITE_BUYBACK_DEADLINE_OFFSET_SEC || 3600);
const AVG_BLOCK_TIME = Number(import.meta.env.VITE_AVG_BLOCK_TIME || 2);
const USDC_TOKEN_ID = import.meta.env.VITE_USDC_TOKEN_ID || "0.0.456858";
const WHBAR_TOKEN_ID = import.meta.env.VITE_WHBAR_TOKEN_ID || "0.0.15058";
const SAUCERSWAP_API_URL = import.meta.env.VITE_SAUCERSWAP_API_URL || "https://test-api.saucerswap.finance";
const SAUCERSWAP_API_KEY = import.meta.env.VITE_SAUCERSWAP_API_KEY || "";
const DEFAULT_FEE = 3000;

interface SaucerswapPool {
  id: number;
  fee?: string;
  tokenA: { id: string; symbol: string };
  tokenB: { id: string; symbol: string };
}

async function fetchSaucerswapPools(path: string): Promise<SaucerswapPool[] | null> {
  try {
    const url = `${SAUCERSWAP_API_URL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (SAUCERSWAP_API_KEY) {
      headers["x-api-key"] = SAUCERSWAP_API_KEY;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Saucerswap API error (${path}): ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`Saucerswap: Failed to fetch pools from ${path}`, error);
    return null;
  }
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

function buildPath(tokens: string[], fees: string[], version?: "V1" | "V2" | null): string {
  if (tokens.length < 2) {
    return "0x";
  }
  if (version === "V1") {
    const coder = new ethers.utils.AbiCoder();
    const formattedTokens = tokens.map((t) => (t.startsWith("0x") ? t : "0x" + t));
    return coder.encode(["address[]"], [formattedTokens]);
  }
  let path = "0x";
  for (let i = 0; i < tokens.length; i++) {
    path += strip0x(tokens[i]);
    if (i < fees.length) {
      path += fees[i];
    }
  }
  return path;
}

function normalizeToSolidityAddress(input: string): string {
  const v = (input || "").trim();
  if (!v) return "";
  if (v.startsWith("0x")) return v.toLowerCase();
  if (v.match(/^[0-9a-fA-F]{40}$/)) return "0x" + v.toLowerCase();
  try {
    const addr = TokenId.fromString(v).toSolidityAddress();
    return "0x" + addr.toLowerCase();
  } catch {
    return v.startsWith("0x") ? v.toLowerCase() : "0x" + v.toLowerCase();
  }
}

function isWhbarToken(address: string): boolean {
  const normalized = normalizeToSolidityAddress(address);
  const whbarNormalized = normalizeToSolidityAddress(WHBAR_TOKEN_ID);
  return normalized.toLowerCase() === whbarNormalized.toLowerCase();
}

async function getTokenIdFromAddress(address: string): Promise<string> {
  const v = (address || "").trim();
  if (!v) return "";
  if (v.match(/^\d+\.\d+\.\d+$/)) {
    return v;
  }
  const hex = v.startsWith("0x") ? v : "0x" + v;
  if (ethers.utils.isAddress(hex)) {
    try {
      const result = solidityAddressToTokenIdString(hex);
      if (result && result !== hex) return result;
    } catch {
      /* ignore */
    }
  }
  return v;
}

async function getPoolFeeHex(
  tokenInAddress: string,
  tokenOutAddress: string
): Promise<{ feeHex: string; version: "V1" | "V2" } | null> {
  try {
    const [tokenInId, tokenOutId] = await Promise.all([
      getTokenIdFromAddress(tokenInAddress),
      getTokenIdFromAddress(tokenOutAddress),
    ]);

    if (!tokenInId || !tokenOutId) {
      console.warn("Could not resolve token IDs for fee lookup", { tokenInAddress, tokenOutAddress });
      return null;
    }

    const v1Pools = await fetchSaucerswapPools("/pools");
    const v1Pool = v1Pools?.find(
      (p) =>
        (p.tokenA.id === tokenInId && p.tokenB.id === tokenOutId) ||
        (p.tokenA.id === tokenOutId && p.tokenB.id === tokenInId)
    );

    if (v1Pool) {
      return {
        feeHex: DEFAULT_FEE.toString(16).padStart(6, "0"),
        version: "V1",
      };
    }

    const v2Pools = await fetchSaucerswapPools("/v2/pools");
    const v2Pool = v2Pools?.find(
      (p) =>
        (p.tokenA.id === tokenInId && p.tokenB.id === tokenOutId) ||
        (p.tokenA.id === tokenOutId && p.tokenB.id === tokenInId)
    );

    if (v2Pool) {
      const feeNumber = Number(v2Pool.fee);
      if (Number.isFinite(feeNumber) && feeNumber >= 0) {
        return {
          feeHex: feeNumber.toString(16).padStart(6, "0"),
          version: "V2",
        };
      }
    }

    console.warn(`Saucerswap: No pool found for ${tokenInId}/${tokenOutId}`);
    return null;
  } catch (error) {
    console.error("Saucerswap: Failed to fetch pool fee", error);
    return null;
  }
}

async function getQuoteTokenForDaoToken(
  daoTokenId: string
): Promise<{ tokenId: string; version: "V1" | "V2"; feeHex: string } | null> {
  if (!daoTokenId) return null;
  try {
    const resolvedDaoTokenId = await getTokenIdFromAddress(daoTokenId);

    const v1Pools = await fetchSaucerswapPools("/pools");
    if (v1Pools) {
      const usdcId = USDC_TOKEN_ID;
      const usdcPool = v1Pools.find(
        (p) =>
          (p.tokenA.id === resolvedDaoTokenId && p.tokenB.id === usdcId) ||
          (p.tokenB.id === resolvedDaoTokenId && p.tokenA.id === usdcId)
      );
      if (usdcPool) {
        return { tokenId: usdcId, version: "V1", feeHex: DEFAULT_FEE.toString(16).padStart(6, "0") };
      }
    }

    const v2Pools = await fetchSaucerswapPools("/v2/pools");
    if (v2Pools) {
      const usdcId = USDC_TOKEN_ID;
      const usdcPool = v2Pools.find(
        (p) =>
          (p.tokenA.id === resolvedDaoTokenId && p.tokenB.id === usdcId) ||
          (p.tokenB.id === resolvedDaoTokenId && p.tokenA.id === usdcId)
      );
      if (usdcPool) {
        const feeNumber = Number(usdcPool.fee);
        const feeHex = Number.isFinite(feeNumber)
          ? feeNumber.toString(16).padStart(6, "0")
          : DEFAULT_FEE.toString(16).padStart(6, "0");
        return { tokenId: usdcId, version: "V2", feeHex };
      }
    }

    console.warn(`Saucerswap: No USDC pool found for DAO Token ${resolvedDaoTokenId}`);
    return null;
  } catch (e) {
    console.error("Failed to fetch pools for DAO Token", e);
    return null;
  }
}

interface SaucerswapTokenInfo {
  decimals: number;
  symbol?: string;
  priceUsd?: number;
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
      priceUsd: data?.priceUsd,
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
  priceUsd?: number;
}

export function DAOBuybackAndBurnForm() {
  const daos = useDAOs();
  const daoAccountIdQueryResults = useFetchContract(SINGLE_DAO_ID)!;
  const foundDao = daos?.data?.find(
    (d) => d.accountEVMAddress.toLowerCase() === daoAccountIdQueryResults?.data?.data.evm_address.toLowerCase()
  ) as GovernanceDAODetails | undefined;

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
  const [liquidityError, setLiquidityError] = useState<string | null>(null);

  const [daoTokenPriceUsd, setDaoTokenPriceUsd] = useState<number | undefined>();
  const [selectedTokenPriceUsd, setSelectedTokenPriceUsd] = useState<number | undefined>();

  // Fee state
  const [poolFeeHex, setPoolFeeHex] = useState<string | null>(null);
  const [poolFeeQuoteToDaoHex, setPoolFeeQuoteToDaoHex] = useState<string | null>(null);
  const [poolVersionTokenToQuote, setPoolVersionTokenToQuote] = useState<"V1" | "V2" | null>(null);
  const [poolVersionQuoteToDao, setPoolVersionQuoteToDao] = useState<"V1" | "V2" | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);

  // Slippage modes
  const [usePercentMinQuoteOut, setUsePercentMinQuoteOut] = useState(true);
  const [minQuoteOutPercent, setMinQuoteOutPercent] = useState<string>("80");
  const [usePercentMinAmountOut, setUsePercentMinAmountOut] = useState(true);
  const [minAmountOutPercent, setMinAmountOutPercent] = useState<string>("80");

  const [maxHtkPriceDollars, setMaxHtkPriceDollars] = useState<string>("");

  const [governanceValues, setGovernanceValues] = useState({
    votingDelay: 0,
    votingPeriod: 0,
    timelockMinDelay: 0,
  });

  const amountIn = watch("buybackAndBurnData.amountIn");
  const [daoTokenInfo, setDaoTokenInfo] = useState<{ symbol?: string; decimals: number }>({ decimals: 8 });

  useEffect(() => {
    if (foundDao?.tokenId) {
      getTokenInfoFromSaucerswap(foundDao.tokenId).then((data) => {
        setDaoTokenInfo(data);
        setDaoTokenPriceUsd(data.priceUsd);
      });
    }
  }, [foundDao?.tokenId]);

  const isDirectQuote =
    selectedToken &&
    quoteTokenAddress &&
    normalizeToSolidityAddress(selectedToken.address).toLowerCase() === quoteTokenAddress.toLowerCase();

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
                    tokenInfo.priceUsd = saucerswapData.priceUsd;
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
                    tokenInfo.priceUsd = saucerswapData.priceUsd;
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

  // Load quote token address dynamically based on DAO Token
  useEffect(() => {
    async function loadQuoteToken() {
      if (!foundDao?.tokenId) return;
      setLiquidityError(null);

      try {
        const result = await getQuoteTokenForDaoToken(foundDao.tokenId);

        if (!result) {
          setLiquidityError(
            `
            No USDC liquidity pool found for DAO token (${foundDao.tokenId}). 
            Buyback and Burn requires a USDC liquidity pair.
            `
          );
          setQuoteTokenAddress("");
          setPoolVersionQuoteToDao(null);
          return;
        }

        const quoteAddr = normalizeToSolidityAddress(result.tokenId);
        setQuoteTokenAddress(quoteAddr);
        setPoolVersionQuoteToDao(result.version);
        setPoolFeeQuoteToDaoHex(result.feeHex);

        try {
          const saucerswapData = await getTokenInfoFromSaucerswap(quoteAddr);
          if (saucerswapData.decimals) {
            setQuoteTokenDecimals(saucerswapData.decimals);
          }
        } catch {
          setQuoteTokenDecimals(6);
        }
      } catch (e) {
        console.error("Error loading quote token:", e);
        setLiquidityError("Failed to verify liquidity pools for DAO token.");
      }
    }
    loadQuoteToken();
  }, [foundDao?.tokenId]);

  useEffect(() => {
    async function fetchGovernanceDetails() {
      try {
        if (foundDao) {
          setGovernanceValues({
            votingDelay: foundDao.votingDelay,
            votingPeriod: foundDao.votingPeriod,
            timelockMinDelay: 0,
          });
        }
      } catch (e) {
        console.error("Failed to fetch governance details", e);
      }
    }
    fetchGovernanceDetails();
  }, [foundDao]);

  useEffect(() => {
    if (!selectedToken || !quoteTokenAddress) {
      setPoolFeeHex(null);
      setPoolVersionTokenToQuote(null);
      return;
    }

    let ignore = false;
    async function fetchFee() {
      setFeeLoading(true);
      setFeeError(null);
      try {
        // For HBAR swaps, lookup pool using WHBAR token ID
        const tokenInAddr = isWhbarToken(selectedToken?.address || "")
          ? normalizeToSolidityAddress(WHBAR_TOKEN_ID)
          : normalizeToSolidityAddress(selectedToken?.address || "0x");
        const result = await getPoolFeeHex(tokenInAddr, quoteTokenAddress);

        if (!ignore) {
          if (result) {
            setPoolFeeHex(result.feeHex);
            setPoolVersionTokenToQuote(result.version);
            setFeeError(null);
          } else {
            setPoolFeeHex(DEFAULT_FEE.toString(16).padStart(6, "0"));
            setPoolVersionTokenToQuote(null);
            setFeeError("Pool not found - using default fee (0.3%)");
          }
        }
      } catch (e: any) {
        if (!ignore) {
          setPoolFeeHex(DEFAULT_FEE.toString(16).padStart(6, "0"));
          setPoolVersionTokenToQuote(null);
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
    if (selectedToken && quoteTokenAddress && foundDao?.tokenId) {
      const tokenInAddr = normalizeToSolidityAddress(selectedToken.address);
      const whbarAddr = normalizeToSolidityAddress(WHBAR_TOKEN_ID);
      const isHbar = isWhbarToken(selectedToken.address);
      const daoTokenAddr = normalizeToSolidityAddress(foundDao.tokenId);

      if (poolFeeQuoteToDaoHex) {
        const versionQuoteToDao = poolVersionQuoteToDao || "V2";
        const pathQuoteToHtk = buildPath([quoteTokenAddress, daoTokenAddr], [poolFeeQuoteToDaoHex], versionQuoteToDao);
        setValue("buybackAndBurnData.pathQuoteToHtk", pathQuoteToHtk);
      }

      if (tokenInAddr.toLowerCase() === quoteTokenAddress.toLowerCase()) {
        // Direct Quote (USDC) -> DAO Token.
        // Treasury.sol ignores pathToQuote when tokenIn == QUOTE_TOKEN
        // Set empty path (0x) - contract will handle this case directly
        setValue("buybackAndBurnData.pathToQuote", "0x");
        setValue("buybackAndBurnData.tokenIn", tokenInAddr);
        setValue("buybackAndBurnData.minQuoteOut", "0");
      } else if (isHbar) {
        // HBAR/WHBAR -> Quote (USDC)
        // Treasury.sol requires: path must start with WHBAR and end with QUOTE_TOKEN
        // Uses SwapKind.ExactHBARForTokens
        if (poolFeeHex) {
          const version = poolVersionTokenToQuote || "V2";
          // Path: WHBAR -> USDC
          const path = buildPath([whbarAddr, quoteTokenAddress], [poolFeeHex], version);
          setValue("buybackAndBurnData.pathToQuote", path);
          setValue("buybackAndBurnData.tokenIn", whbarAddr);
        }
      } else if (poolFeeHex) {
        // Regular Token -> Quote (USDC)
        // The contract expects pathToQuote to end at the quote token (USDC).
        const version = poolVersionTokenToQuote || "V2";
        const path = buildPath([tokenInAddr, quoteTokenAddress], [poolFeeHex], version);
        setValue("buybackAndBurnData.pathToQuote", path);
        setValue("buybackAndBurnData.tokenIn", tokenInAddr);
      }
    }
  }, [
    selectedToken,
    quoteTokenAddress,
    poolFeeHex,
    poolFeeQuoteToDaoHex,
    poolVersionTokenToQuote,
    poolVersionQuoteToDao,
    setValue,
    foundDao?.tokenId,
  ]);

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
        const percent = new BigNumber(percentValue || "0");
        const amountInBN = new BigNumber(amountIn || "0");
        const priceRatio = new BigNumber(selectedTokenPriceUsd || 1);
        const minOut = amountInBN.times(priceRatio).times(percent).div(100);
        const scale = new BigNumber(10).pow(quoteTokenDecimals - (selectedToken?.decimals || 0));
        const minOutScaled = minOut.times(scale).integerValue(BigNumber.ROUND_FLOOR);
        setValue("buybackAndBurnData.minQuoteOut", minOutScaled.gt(0) ? minOutScaled.toFixed(0) : "0");
      }
    },
    [usePercentMinQuoteOut, amountIn, selectedToken, quoteTokenDecimals, setValue, selectedTokenPriceUsd]
  );

  const handleMinAmountOutPercentChange = useCallback(
    (percentValue: string) => {
      setMinAmountOutPercent(percentValue);
      if (usePercentMinAmountOut && amountIn && selectedToken?.decimals !== undefined) {
        const percent = new BigNumber(percentValue || "0");
        const amountInBN = new BigNumber(amountIn || "0");
        const priceRatio =
          selectedTokenPriceUsd && daoTokenPriceUsd
            ? new BigNumber(selectedTokenPriceUsd).div(daoTokenPriceUsd)
            : new BigNumber(1);
        const minOut = amountInBN.times(priceRatio).times(percent).div(100);
        const scale = new BigNumber(10).pow(daoTokenInfo.decimals - (selectedToken?.decimals || 0));
        const minOutScaled = minOut.times(scale).integerValue(BigNumber.ROUND_FLOOR);
        setValue("buybackAndBurnData.minAmountOut", minOutScaled.gt(0) ? minOutScaled.toFixed(0) : "0");
      }
    },
    [
      usePercentMinAmountOut,
      amountIn,
      selectedToken,
      setValue,
      selectedTokenPriceUsd,
      daoTokenPriceUsd,
      daoTokenInfo.decimals,
    ]
  );

  useEffect(() => {
    if (usePercentMinQuoteOut && amountIn && selectedToken?.decimals !== undefined) {
      const percent = new BigNumber(minQuoteOutPercent || "0");
      const amountInBN = new BigNumber(amountIn || "0");
      const priceRatio = new BigNumber(selectedTokenPriceUsd || 1);
      const minOut = amountInBN.times(priceRatio).times(percent).div(100);
      const scale = new BigNumber(10).pow(quoteTokenDecimals - (selectedToken?.decimals || 0));
      const minOutScaled = minOut.times(scale).integerValue(BigNumber.ROUND_FLOOR);
      setValue("buybackAndBurnData.minQuoteOut", minOutScaled.gt(0) ? minOutScaled.toFixed(0) : "0");
    }
  }, [
    usePercentMinQuoteOut,
    amountIn,
    selectedToken,
    quoteTokenDecimals,
    minQuoteOutPercent,
    setValue,
    selectedTokenPriceUsd,
  ]);

  useEffect(() => {
    if (usePercentMinAmountOut && amountIn && selectedToken?.decimals !== undefined) {
      const percent = new BigNumber(minAmountOutPercent || "0");
      const amountInBN = new BigNumber(amountIn || "0");
      const priceRatio =
        selectedTokenPriceUsd && daoTokenPriceUsd
          ? new BigNumber(selectedTokenPriceUsd).div(daoTokenPriceUsd)
          : new BigNumber(1);
      const minOut = amountInBN.times(priceRatio).times(percent).div(100);
      const scale = new BigNumber(10).pow(daoTokenInfo.decimals - (selectedToken?.decimals || 0));
      const minOutScaled = minOut.times(scale).integerValue(BigNumber.ROUND_FLOOR);
      setValue("buybackAndBurnData.minAmountOut", minOutScaled.gt(0) ? minOutScaled.toFixed(0) : "0");
    }
  }, [
    usePercentMinAmountOut,
    amountIn,
    selectedToken,
    minAmountOutPercent,
    setValue,
    daoTokenInfo.decimals,
    selectedTokenPriceUsd,
    daoTokenPriceUsd,
  ]);

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
      setSelectedTokenPriceUsd(token?.priceUsd);
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
      <Box bg="purple.50" p={3} borderRadius="md" border="1px solid" borderColor="purple.200">
        <Text color="purple.700" fontWeight="bold" fontSize="sm">
          Proposal Deposit Info
        </Text>
        <Text color="purple.600" fontSize="xs">
          Creating this proposal requires a deposit of <strong>1.0 {daoTokenInfo.symbol || "Governance Token"}</strong>.
          The exact raw amount is <code>{Math.pow(10, daoTokenInfo.decimals)}</code> units. This deposit will be
          returned if the proposal is executed or if it fails but meets certain criteria.
        </Text>
      </Box>
      {loading && <Text color="gray.500">Loading available tokens…</Text>}
      {error && <Text color="red.400">{error}</Text>}
      {liquidityError && (
        <Box bg="red.50" p={3} borderRadius="md" border="1px solid" borderColor="red.200">
          <Text color="red.600" fontWeight="bold">
            Liquidity Error
          </Text>
          <Text color="red.600">{liquidityError}</Text>
        </Box>
      )}
      <Box opacity={liquidityError ? 0.5 : 1} pointerEvents={liquidityError ? "none" : "auto"}>
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
              {isWhbarToken(selectedToken.address) && (
                <Badge colorScheme="orange" fontSize="xs" ml={2} variant="solid">
                  HBAR Swap
                </Badge>
              )}
              <br />
              Decimals: <strong>{selectedToken.decimals ?? "Unknown"}</strong>
              <br />
              Address: <code>{selectedToken.address}</code>
              {isWhbarToken(selectedToken.address) && (
                <Box mt={2} p={2} bg="orange.50" borderRadius="sm">
                  <Text fontSize="xs" color="orange.700">
                    ℹ️ This token will be treated as HBAR. Treasury will use native HBAR for swap.
                  </Text>
                </Box>
              )}
            </Text>
          </Box>

          <Box bg={feeError ? "yellow.50" : "blue.50"} p={3} borderRadius="md">
            <Flex align="center" gap={2} wrap="wrap">
              <Text fontSize="sm" color={feeError ? "yellow.700" : "blue.700"}>
                <strong>Pool Fee:</strong> {feeLoading ? <Spinner size="xs" /> : getFeeDisplayValue()}
              </Text>
              {poolVersionTokenToQuote && (
                <Badge colorScheme="purple" fontSize="xs" variant="subtle">
                  Saucerswap {poolVersionTokenToQuote}
                </Badge>
              )}
            </Flex>
            {feeError && (
              <Text fontSize="xs" color="yellow.600" mt={1}>
                ⚠️ {feeError}
              </Text>
            )}
            <Text fontSize="xs" color="gray.500" mt={2}>
              <strong>Pool Versioning:</strong>
              {!isDirectQuote && (
                <>
                  <br />
                  1. {selectedToken.symbol || "Token"} → USDC:{" "}
                  {poolVersionTokenToQuote ? (
                    <Badge colorScheme="purple" fontSize="2xs" ml={1} variant="subtle">
                      {poolVersionTokenToQuote}
                    </Badge>
                  ) : (
                    "Not found"
                  )}
                </>
              )}
              <br />
              {!isDirectQuote ? "2." : "1."} USDC → {foundDao?.name || "DAO"} Token:{" "}
              {poolVersionQuoteToDao ? (
                <Badge colorScheme="purple" fontSize="2xs" ml={1} variant="subtle">
                  {poolVersionQuoteToDao}
                </Badge>
              ) : (
                "Not found"
              )}
            </Text>
          </Box>

          <Box>
            <FormControl>
              <FormLabel fontWeight="semibold">Amount to Sell (Raw units)</FormLabel>
              <Input
                type="number"
                step="1"
                placeholder={`Enter raw amount of ${selectedToken.symbol || "tokens"}`}
                {...register("buybackAndBurnData.amountIn")}
              />
              <FormHelperText>
                {selectedToken.decimals !== undefined && (
                  <Box>
                    This token has <strong>{selectedToken.decimals}</strong> decimals. Enter the amount in raw units
                    (e.g., if decimals is 8, 1.0 token is 100,000,000).
                    {selectedTokenPriceUsd && amountIn && (
                      <Box mt={1} color="blue.600">
                        Approx. value: $
                        {(
                          (parseFloat(amountIn) / Math.pow(10, selectedToken.decimals)) *
                          selectedTokenPriceUsd
                        ).toFixed(2)}
                      </Box>
                    )}
                  </Box>
                )}
              </FormHelperText>
              {(errors as any)?.buybackAndBurnData?.amountIn && (
                <Text color="red.500" fontSize="sm">
                  {(errors as any).buybackAndBurnData.amountIn.message}
                </Text>
              )}
            </FormControl>
          </Box>

          {!isDirectQuote && (
            <Box>
              <FormControl>
                <Flex justify="space-between" align="center" mb={2}>
                  <FormLabel fontWeight="semibold" mb={0}>
                    Minimum Quote Out (Raw units)
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
                    type="number"
                    step="1"
                    placeholder={`Enter raw minimum USDC output`}
                    {...register("buybackAndBurnData.minQuoteOut")}
                  />
                )}
                <FormHelperText>
                  Minimum amount of USDC to receive from the first swap.
                  {usePercentMinQuoteOut
                    ? " Calculated as percentage of amount to sell, adjusted by current market price."
                    : // eslint-disable-next-line max-len
                      " If the actual output is lower than this during execution, the transaction will fail with a slippage error."}
                  {selectedTokenPriceUsd && (
                    <Box as="span" display="block" color="blue.600" mt={1}>
                      Current price: 1 {selectedToken?.symbol || "token"} ≈ {selectedTokenPriceUsd.toFixed(6)} USDC
                    </Box>
                  )}
                </FormHelperText>
                {(errors as any)?.buybackAndBurnData?.minQuoteOut && (
                  <Text color="red.500" fontSize="sm">
                    {(errors as any).buybackAndBurnData.minQuoteOut.message}
                  </Text>
                )}
              </FormControl>
            </Box>
          )}

          <Box>
            <FormControl>
              <Flex justify="space-between" align="center" mb={2}>
                <FormLabel fontWeight="semibold" mb={0}>
                  Minimum DAO Token Out (Raw units)
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
                  type="number"
                  step="1"
                  placeholder={`Enter raw minimum ${daoTokenInfo.symbol || "DAO"} output`}
                  {...register("buybackAndBurnData.minAmountOut")}
                />
              )}
              <FormHelperText>
                Minimum amount of {daoTokenInfo.symbol || "DAO"} tokens to receive from the final swap.
                {usePercentMinAmountOut
                  ? " Calculated as percentage of expected output, adjusted by current market price."
                  : // eslint-disable-next-line max-len
                    " If the actual output is lower than this during execution, the transaction will fail with a slippage error."}
                {selectedTokenPriceUsd && daoTokenPriceUsd && (
                  <Box as="span" display="block" color="blue.600" mt={1}>
                    {/* eslint-disable-next-line max-len */}
                    Current rate: 1 {selectedToken?.symbol || "token"} ≈{" "}
                    {(selectedTokenPriceUsd / daoTokenPriceUsd).toFixed(6)} {daoTokenInfo.symbol || "DAO"}
                  </Box>
                )}
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
              <FormLabel fontWeight="semibold">Maximum DAO Token Price (in dollars)</FormLabel>
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
                {/* eslint-disable-next-line max-len */}
                Maximum price you are willing to pay per {daoTokenInfo.symbol || "DAO"} token in dollars (up to 6
                decimals). Leave empty or 0 for no limit.
                {daoTokenPriceUsd && (
                  <Box as="span" display="block" mt={1}>
                    Current market price:{" "}
                    <Text
                      as="span"
                      color="blue.600"
                      fontWeight="bold"
                      cursor="pointer"
                      textDecoration="underline"
                      onClick={() => handleMaxHtkPriceChange(daoTokenPriceUsd.toString())}
                    >
                      ${daoTokenPriceUsd.toFixed(6)}
                    </Text>
                  </Box>
                )}
              </FormHelperText>
            </FormControl>
          </Box>
        </>
      )}
    </Flex>
  );
}
