import { useQuery } from "react-query";
import {
  useDexContext,
  useCastVote,
  useExecuteGovernanceProposal,
  useCancelProposal,
  useHandleTransactionSuccess,
} from "@dex/hooks";
import {
  useDAOs,
  ProposalStatus,
  useGovernanceDAOProposals,
  useChangeAdmin,
  useFetchContract,
  DAOQueries,
} from "@dao/hooks";
import { DAOType, GovernanceDAODetails, NFTDAODetails } from "@dao/services";
import { isNotNil } from "ramda";
import { TransactionResponse } from "@hashgraph/sdk";
import { getProposalData } from "../utils";
import { DEX_TOKEN_PRECISION_VALUE, DexService } from "@dex/services";
import BigNumber from "bignumber.js";
import { Proposal, ProposalType } from "@dao/hooks";
import { SINGLE_DAO_DEX_SETTINGS } from "@dao/config/singleDao";
import { ContractId } from "@hashgraph/sdk";
import { ContractInterface, ethers } from "ethers";
import { solidityAddressToTokenIdString } from "@shared/utils";

function shortenAddress(address: string, startLength: number = 6, endLength: number = 6) {
  const addr = (address || "").trim();
  if (addr.length <= startLength + endLength) return addr;
  const start = addr.slice(0, startLength);
  const end = addr.slice(-endLength);
  return `${start}...${end}`;
}

async function fetchTokenSymbol(label: string): Promise<string | undefined> {
  try {
    const v = (label || "").trim();
    if (!v) return undefined;
    const tokenId = (ethers as any)?.utils?.isAddress?.(v) ? solidityAddressToTokenIdString(v) : v;
    if (!tokenId.includes(".")) return undefined;
    const res = await DexService.fetchTokenData(tokenId);
    return res?.data?.symbol as string | undefined;
  } catch {
    return undefined;
  }
}

async function fetchCurrentWhitelistPairs(): Promise<{ tokenA: string; tokenB: string }[]> {
  try {
    const cfg = SINGLE_DAO_DEX_SETTINGS?.pairWhitelist;
    const address = ContractId.fromString(cfg?.contractId as string).toSolidityAddress();
    const { JsonRpcSigner } = DexService.getJsonRpcProviderAndSigner();
    const contract = new ethers.Contract(address, cfg?.abi as ContractInterface, JsonRpcSigner);
    const method = cfg?.methods?.getPairs || "getAllWhitelistedPairs";
    const out = await contract[method]();
    const res: { tokenA: string; tokenB: string }[] = [];
    if (Array.isArray(out)) {
      for (const item of out) {
        try {
          const tokenIn = typeof item?.tokenIn === "string" ? item.tokenIn : Array.isArray(item) ? item[0] : undefined;
          const tokenOut =
            typeof item?.tokenOut === "string" ? item.tokenOut : Array.isArray(item) ? item[1] : undefined;
          if (typeof tokenIn === "string" && typeof tokenOut === "string") {
            res.push({ tokenA: tokenIn, tokenB: tokenOut });
          }
        } catch {
          /* ignore single item */
        }
      }
    }
    return res;
  } catch {
    return [];
  }
}

async function buildFancyDescription(proposal: Proposal): Promise<string> {
  try {
    if (
      proposal.type === ProposalType.AddTradingPairProposal ||
      proposal.type === ProposalType.RemoveTradingPairProposal
    ) {
      const data = (proposal.data as any) || {};
      const tokenIn: string = data?.tokenIn || "";
      const tokenOut: string = data?.tokenOut || "";

      const [symIn, symOut] = await Promise.all([fetchTokenSymbol(tokenIn), fetchTokenSymbol(tokenOut)]);
      const inLabel = symIn ? `${symIn} (${shortenAddress(tokenIn)})` : shortenAddress(tokenIn);
      const outLabel = symOut ? `${symOut} (${shortenAddress(tokenOut)})` : shortenAddress(tokenOut);

      // current pairs where tokenA === tokenIn
      const pairs = await fetchCurrentWhitelistPairs();
      const related = pairs.filter((p) => (p?.tokenA || "").toLowerCase() === (tokenIn || "").toLowerCase());
      const uniqueOuts = Array.from(new Set(related.map((p) => p.tokenB)));
      const outsWithLabels = await Promise.all(
        uniqueOuts.map(async (addr) => {
          const sym = await fetchTokenSymbol(addr);
          return sym ? `${sym} (${shortenAddress(addr)})` : shortenAddress(addr);
        })
      );
      const currentPairsLines =
        outsWithLabels.length > 0 ? outsWithLabels.map((lbl) => `${inLabel} / ${lbl}`) : ["(none)"];
      const proposalLine = `${inLabel} / ${outLabel}`;
      const action = proposal.type === ProposalType.AddTradingPairProposal ? "Add pair" : "Remove pair";
      return [`${action}`, "", "current pairs:", ...currentPairsLines, "", `proposal pair: ${proposalLine}`].join("\n");
    }

    if (proposal.type === ProposalType.RiskParametersProposal) {
      const data = (proposal.data as any) || {};
      const proposed = {
        maxTradeBps: data?.maxTradeBps,
        maxSlippageBps: data?.maxSlippageBps,
        tradeCooldownSec: data?.tradeCooldownSec,
      };

      const toNum = (v: any): number | undefined => {
        if (v === null || v === undefined) return undefined;
        try {
          const n = typeof v === "object" && typeof v.toString === "function" ? Number(v.toString()) : Number(v);
          return Number.isFinite(n) ? n : undefined;
        } catch {
          return undefined;
        }
      };

      let current: { maxTradeBps?: number; maxSlippageBps?: number; tradeCooldownSec?: number } = {};
      try {
        const cfg = SINGLE_DAO_DEX_SETTINGS?.parameterStore;
        if (cfg?.contractId && cfg?.abi) {
          const address = ContractId.fromString(cfg.contractId).toSolidityAddress();
          const { JsonRpcSigner } = DexService.getJsonRpcProviderAndSigner();
          const contract = new ethers.Contract(address, cfg.abi, JsonRpcSigner);

          try {
            const riskParameters = await contract[cfg.methods!.getRiskParameters!]();
            const a = toNum((riskParameters as any)?.maxTradeBps);
            const b = toNum((riskParameters as any)?.maxSlippageBps);
            const c = toNum((riskParameters as any)?.tradeCooldownSec);
            current = { maxTradeBps: a, maxSlippageBps: b, tradeCooldownSec: c };
          } catch {
            /* empty */
          }
          try {
            if (
              current.maxTradeBps === undefined ||
              current.maxSlippageBps === undefined ||
              current.tradeCooldownSec === undefined
            ) {
              const tuple = await contract[cfg.methods!.getRiskParameters!]();
              if (Array.isArray(tuple) && tuple.length >= 3) {
                current = {
                  maxTradeBps: current.maxTradeBps ?? toNum(tuple[0]),
                  maxSlippageBps: current.maxSlippageBps ?? toNum(tuple[1]),
                  tradeCooldownSec: current.tradeCooldownSec ?? toNum(tuple[2]),
                };
              }
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      const currentLine = `current: maxTradeBps=${
        current.maxTradeBps !== undefined ? current.maxTradeBps : "?"
      }, maxSlippageBps=${current.maxSlippageBps !== undefined ? current.maxSlippageBps : "?"}, cooldownSec=${
        current.tradeCooldownSec !== undefined ? current.tradeCooldownSec : "?"
      }`;
      const proposedLine = `proposed: maxTradeBps=${
        proposed.maxTradeBps !== undefined ? proposed.maxTradeBps : "?"
      }, maxSlippageBps=${proposed.maxSlippageBps !== undefined ? proposed.maxSlippageBps : "?"}, cooldownSec=${
        proposed.tradeCooldownSec !== undefined ? proposed.tradeCooldownSec : "?"
      }`;
      return ["Parameters", currentLine, proposedLine].join("\n");
    }

    if (proposal.type === ProposalType.BuybackAndBurnProposal) {
      const data = (proposal.data as any) || {};
      const tokenIn: string = data?.tokenIn || "";
      const amountIn: string = data?.amountIn || "0";
      const minQuoteOut: string = data?.minQuoteOut || "0";
      const minAmountOut: string = data?.minAmountOut || "0";
      const maxHtkPriceD18: string = data?.maxHtkPriceD18 || "0";
      const deadline: string = data?.deadline || "0";

      const symIn = await fetchTokenSymbol(tokenIn);
      const inLabel = symIn ? `${symIn} (${shortenAddress(tokenIn)})` : shortenAddress(tokenIn);

      const maxPrice = new BigNumber(maxHtkPriceD18).shiftedBy(-18).toString();
      const isNoLimit = maxHtkPriceD18 === "0" || maxHtkPriceD18 === ethers.constants.MaxUint256.toString();
      const deadlineDate = new Date(Number(deadline) * 1000).toLocaleString();

      const lines = [
        `Buyback and Burn`,
        `Token to sell: ${inLabel}`,
        `Amount in: ${amountIn} (raw units)`,
        `Min quote out: ${minQuoteOut} (raw units)`,
        `Min KAI out: ${minAmountOut} (raw units)`,
        `Max KAI price: ${isNoLimit ? "No limit" : `$${maxPrice}`}`,
        `Deadline: ${deadlineDate}`,
      ];

      return lines.join("\n");
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function useGovernanceProposalDetails(daoAccountId: string, proposalId: string | undefined) {
  const { wallet } = useDexContext(({ wallet }) => ({ wallet }));
  const castVote = useCastVote(proposalId, handleVoteForProposalSuccess);
  const cancelProposal = useCancelProposal(proposalId);
  const executeProposal = useExecuteGovernanceProposal(proposalId, handleExecuteProposalSuccess);
  const changeAdminMutation = useChangeAdmin(handleExecuteProposalSuccess);
  const handleTransactionSuccess = useHandleTransactionSuccess();

  const daoAccountIdQueryResults = useFetchContract(daoAccountId);
  const daoAccountEVMAddress = daoAccountIdQueryResults.data?.data.evm_address;
  const daosQueryResults = useDAOs<GovernanceDAODetails | NFTDAODetails>();
  const { data: daos } = daosQueryResults;
  const dao = daos?.find(
    (dao: GovernanceDAODetails | NFTDAODetails) =>
      dao.accountEVMAddress.toLowerCase() == daoAccountEVMAddress?.toLowerCase()
  );
  const daoProposalsQueryResults = useGovernanceDAOProposals(
    daoAccountId,
    dao?.tokenId,
    dao?.governorAddress,
    dao?.assetsHolderAddress
  );
  const { data: proposals } = daoProposalsQueryResults;
  const proposal = proposals?.find((proposal) => proposal.proposalId === proposalId);
  const isDataFetched =
    daosQueryResults.isSuccess && daoProposalsQueryResults.isSuccess && isNotNil(dao) && isNotNil(proposal);

  const hasVoted = proposal?.hasVoted ?? false;
  const walletId = wallet?.savedPairingData?.accountIds[0] ?? "";

  // eslint-disable-next-line max-len
  const snapshotVotingPowerQuery = useQuery<
    number,
    Error,
    number,
    [DAOQueries, string, string, string | undefined, string | undefined]
  >(
    [DAOQueries.Proposals, "VotingPower", dao?.tokenId ?? "", proposalId, walletId],
    async () => {
      if (!dao?.tokenId || !proposal?.timestamp || !walletId) return 0;
      const resp: any = await DexService.fetchTokenBalancesAt(dao.tokenId, proposal.timestamp);
      const balances: any[] = resp?.data?.balances ?? resp?.balances ?? [];
      // eslint-disable-next-line max-len
      const precisionValue = proposal?.token?.data?.decimals
        ? +proposal.token.data.decimals
        : DEX_TOKEN_PRECISION_VALUE;
      const entry = balances.find((b: any) => b?.account === walletId);
      const balRaw = new BigNumber((entry?.balance ?? 0).toString());
      return balRaw.shiftedBy(-precisionValue).toNumber();
    },
    {
      enabled: !!dao?.tokenId && !!proposal?.timestamp && !!walletId && dao?.type === DAOType.GovernanceToken,
      staleTime: 5,
    }
  );

  const votingPower = `${(snapshotVotingPowerQuery.data ?? 0).toFixed(4)}`;
  const areVoteButtonsVisible = !hasVoted && proposal?.status === ProposalStatus.Pending;
  const isAuthor = walletId === proposal?.author;
  const assetHolderContractId = useFetchContract(dao?.assetsHolderAddress ?? "").data?.data.contract_id;

  function handleVoteForProposalSuccess(transactionResponse: TransactionResponse) {
    castVote.reset();
    const message = "Vote has been casted.";
    handleTransactionSuccess(transactionResponse, message);
  }

  function handleExecuteProposalSuccess(transactionResponse: TransactionResponse) {
    executeProposal.reset();
    const message = "Proposal has been executed.";
    handleTransactionSuccess(transactionResponse, message);
  }
  const subDescriptionQuery = useQuery<
    string,
    Error,
    string,
    [DAOQueries, string, string | undefined, string | undefined]
  >(
    [DAOQueries.Proposals, "ProposalSubDescription", proposal?.proposalId, proposal?.type?.toString()],
    async () => {
      if (!proposal) return "";
      const fancy = await buildFancyDescription(proposal);
      if (fancy && fancy.trim().length > 0) return fancy;
      return getProposalData(proposal);
    },
    { enabled: !!proposal }
  );
  const subDescription = subDescriptionQuery.data ?? (isNotNil(proposal) ? getProposalData(proposal) : "");
  return {
    proposalDetails: isDataFetched
      ? {
          ...proposal,
          daoType: dao?.type,
          dao: dao,
        }
      : undefined,
    castVote,
    cancelProposal,
    hasVoted,
    executeProposal,
    changeAdminMutation,
    votingPower,
    areVoteButtonsVisible,
    isAuthor,
    subDescription,
    assetHolderContractId,
    contractUpgradeLogic: dao?.assetsHolderAddress,
    isSuccess: daosQueryResults.isSuccess && daoProposalsQueryResults.isSuccess,
    isLoading: daosQueryResults.isLoading || daoProposalsQueryResults.isLoading,
    isError: daosQueryResults.isError || daoProposalsQueryResults.isError,
    error: daosQueryResults.error || daoProposalsQueryResults.error,
  };
}
