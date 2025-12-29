import { Flex, Text, Box, Divider, Badge } from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { CreateDAODexSettingsForm } from "../types";
import { useEffect, useState } from "react";
import { DexService, MirrorNodeTokenById } from "@dex/services";
import { solidityAddressToTokenIdString } from "@shared/utils";
import { ethers } from "ethers";

function shortenAddress(address: string, startLength: number = 10, endLength: number = 8) {
  const addr = address.trim();
  if (addr.length <= startLength + endLength) return addr;
  const start = addr.slice(0, startLength);
  const end = addr.slice(-endLength);
  return `${start}...${end}`;
}

function formatTimestamp(timestampSec: string): string {
  try {
    const ts = parseInt(timestampSec, 10);
    if (isNaN(ts)) return timestampSec;
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return timestampSec;
  }
}

function formatBigNumber(value: string, decimals: number = 18): string {
  try {
    const bn = ethers.BigNumber.from(value);
    return ethers.utils.formatUnits(bn, decimals);
  } catch {
    return value;
  }
}

export function DAOBuybackAndBurnReviewForm() {
  const { getValues } = useFormContext<CreateDAODexSettingsForm>();
  const formValues = getValues();
  const buybackData = formValues.buybackAndBurnData;

  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!buybackData?.tokenIn) return;

    let ignore = false;
    async function fetchTokenInfo() {
      setLoading(true);
      try {
        const addr = buybackData.tokenIn;
        let tokenId = addr;
        if ((ethers as any)?.utils?.isAddress?.(addr)) {
          tokenId = solidityAddressToTokenIdString(addr) || addr;
        }
        if (tokenId && tokenId.includes(".")) {
          const data: MirrorNodeTokenById = await DexService.fetchTokenData(tokenId);
          if (!ignore && data?.data) {
            setTokenSymbol(data.data.symbol || "");
            setTokenDecimals(Number(data.data.decimals));
          }
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchTokenInfo();
    return () => {
      ignore = true;
    };
  }, [buybackData?.tokenIn]);

  if (!buybackData) {
    return (
      <Flex direction="column" gap="1rem">
        <Text fontWeight="bold">Review Buyback and Burn</Text>
        <Text color="red.400">No buyback data provided. Please go back and configure the form.</Text>
      </Flex>
    );
  }

  const displayTokenIn = tokenSymbol
    ? `${tokenSymbol} (${shortenAddress(buybackData.tokenIn)})`
    : shortenAddress(buybackData.tokenIn);

  const formattedAmountIn =
    tokenDecimals !== null ? formatBigNumber(buybackData.amountIn, tokenDecimals) : buybackData.amountIn;

  const formattedMaxHtkPrice =
    buybackData.maxHtkPriceD18 && buybackData.maxHtkPriceD18 !== ethers.constants.MaxUint256.toString()
      ? `$${formatBigNumber(buybackData.maxHtkPriceD18, 18)}`
      : "No limit";

  return (
    <Flex direction="column" gap="1.2rem">
      <Text fontWeight="bold" fontSize="lg">
        Review Buyback and Burn Proposal
      </Text>

      <Box bg="gray.50" p={4} borderRadius="md">
        <Flex direction="column" gap="0.8rem">
          {/* Token to Sell */}
          <Box>
            <Text fontWeight="semibold" color="gray.600" fontSize="sm">
              Token to Sell
            </Text>
            <Text fontSize="md">{loading ? "Loading..." : displayTokenIn}</Text>
            {tokenDecimals !== null && (
              <Badge colorScheme="blue" ml={2}>
                {tokenDecimals} decimals
              </Badge>
            )}
          </Box>

          <Divider />

          {/* Amount In */}
          <Box>
            <Text fontWeight="semibold" color="gray.600" fontSize="sm">
              Amount In
            </Text>
            <Text fontSize="md" fontFamily="mono">
              {formattedAmountIn}
              {tokenSymbol && ` ${tokenSymbol}`}
            </Text>
            <Text fontSize="xs" color="gray.500">
              Raw: {buybackData.amountIn}
            </Text>
          </Box>

          <Divider />

          {/* Minimum Quote Out */}
          <Box>
            <Text fontWeight="semibold" color="gray.600" fontSize="sm">
              Minimum Quote Out (USDC)
            </Text>
            <Text fontSize="md" fontFamily="mono">
              {formatBigNumber(buybackData.minQuoteOut, 6)} USDC
            </Text>
            <Text fontSize="xs" color="gray.500">
              Raw: {buybackData.minQuoteOut}
            </Text>
          </Box>

          <Divider />

          {/* Minimum KAI Out */}
          <Box>
            <Text fontWeight="semibold" color="gray.600" fontSize="sm">
              Minimum KAI Out
            </Text>
            <Text fontSize="md" fontFamily="mono">
              {formatBigNumber(buybackData.minAmountOut, 18)} KAI
            </Text>
            <Text fontSize="xs" color="gray.500">
              Raw: {buybackData.minAmountOut}
            </Text>
          </Box>

          <Divider />

          {/* Max KAI Price */}
          <Box>
            <Text fontWeight="semibold" color="gray.600" fontSize="sm">
              Maximum KAI Price
            </Text>
            <Text fontSize="md">{formattedMaxHtkPrice}</Text>
            {buybackData.maxHtkPriceD18 !== ethers.constants.MaxUint256.toString() && (
              <Text fontSize="xs" color="gray.500">
                Raw (D18): {buybackData.maxHtkPriceD18}
              </Text>
            )}
          </Box>

          <Divider />

          {/* Deadline */}
          <Box>
            <Text fontWeight="semibold" color="gray.600" fontSize="sm">
              Deadline
            </Text>
            <Text fontSize="md">{formatTimestamp(buybackData.deadline)}</Text>
            <Text fontSize="xs" color="gray.500">
              Unix timestamp: {buybackData.deadline}
            </Text>
          </Box>
        </Flex>
      </Box>
    </Flex>
  );
}
