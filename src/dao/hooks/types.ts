import { ProposalState } from "@dex/store";
import { MirrorNodeTokenById, ProposalCoreInformation } from "@dex/services";

export enum DAOQueries {
  DAOs = "daos",
  Proposals = "proposals",
  FetchLockNFTToken = "fetchLockNFTToken",
  FetchCanUnlockNFTToken = "fetchCanUnlockNFTToken",
  FetchDAOMembers = "fetchDAOMembers",
  Contract = "contract",
  Config = "Config",
  IPFSContent = "IPFSContent",
}

export enum DAOMutations {
  ApproveProposal = "ApproveProposal",
  ExecuteProposal = "ExecuteProposal",
  UpdateDAODetails = "UpdateDAODetails",
  MintNFTTokens = "MintNFTTokens",
  DepositTokens = "DepositTokens",
  ChangeAdmin = "ChangeAdmin",
  LockNFTToken = "lockNFTToken",
  UnlockNFTToken = "unlockNFTToken",
  PinToIPFS = "PinToIPFS",
  TransferOwnership = "TransferOwnership",
  CreateRiskParametersProposal = "CreateRiskParametersProposal",
  CreateRemoveTradingPairProposal = "CreateRemoveTradingPairProposal",
  CreateAddTradingPairProposal = "CreateAddTradingPairProposal",
  CreateBuybackAndBurnProposal = "CreateBuybackAndBurnProposal",
}

export enum ProposalStatus {
  Pending = "Active",
  Queued = "Queued",
  Success = "Executed",
  Failed = "Failed",
}

export enum ProposalEvent {
  Send = "Send",
  Receive = "Receive",
  Governance = "Governance",
  SafeCreated = "Safe Created",
}

export enum ProposalType {
  TokenTransfer = "Token Transfer",
  UpgradeContract = "Upgrade Contract",
  RiskParametersProposal = "Risk Parameters",
  AddTradingPairProposal = "Add Trading Pair",
  RemoveTradingPairProposal = "Remove Trading Pair",
  BuybackAndBurnProposal = "Buyback and Burn",
}

export interface Votes {
  yes: number | undefined;
  no: number | undefined;
  abstain: number | undefined;
  quorum: number | undefined;
  remaining: number | undefined;
  max: number | undefined;
  turnout: number | undefined;
}

export interface GOVRiskParametersProposalDetails {
  maxTradeBps: number;
  maxSlippageBps: number;
  tradeCooldownSec: number;
}

export interface GOVTradingPairProposalDetails {
  tokenIn: string;
  tokenOut: string;
}

export interface GOVBuybackAndBurnProposalDetails {
  tokenIn: string;
  pathToQuote: string;
  amountIn: string;
  minQuoteOut: string;
  minAmountOut: string;
  maxHtkPriceD18: string;
  deadline: string;
}

export type ProposalData =
  | GOVTradingPairProposalDetails
  | GOVRiskParametersProposalDetails
  | GOVBuybackAndBurnProposalDetails;

export interface Proposal {
  id: number;
  nonce: number;
  transactionHash?: string;
  amount: number;
  type: ProposalType;
  approvalCount: number;
  approvers: string[];
  event: ProposalEvent;
  status: ProposalStatus;
  timestamp: string;
  tokenId: string;
  token: MirrorNodeTokenById | null | undefined;
  receiver: string;
  sender?: string;
  safeEVMAddress: string;
  to: string;
  operation: number;
  hexStringData: string;
  data: ProposalData | undefined;
  /**
   * The hbar value sent when creating the proposal. This value is needed to
   * compute the correct hash value when executing the proposal in the HederaGnosisSafe contract.
   **/
  msgValue: number;
  title: string;
  author: string;
  description: string;
  metadata: string;
  link: string | undefined;
  threshold: number | undefined;
  proposalId?: string;
  contractEvmAddress?: string;
  timeRemaining?: number;
  votes?: Votes;
  hasVoted?: boolean;
  isQuorumReached?: boolean;
  votingEndTime?: number;
  proposalState?: ProposalState;
  coreInformation?: ProposalCoreInformation;
  showTransferOwnerShip?: boolean;
  currentOwner?: string | undefined;
  targetId?: string;
  feeConfigControllerUser?: string;

  /**
   * TODO: To be removed
   * Extra objects to check for DAO upgrade Proposal
   **/
  isContractUpgradeProposal?: boolean;
}

export const AllFilters = [
  ProposalStatus.Success,
  ProposalStatus.Failed,
  ProposalStatus.Pending,
  ProposalStatus.Queued,
];

export interface UpdateAmountEventData {
  user: string;
  idOrAmount: number;
}

export interface DAOConfigDetails {
  daoFee: number;
  daoTreasurer: string;
  tokenAddress: string;
  symbol: string;
  tokenId: string;
  tokenType: string;
  decimals: number;
  preciseDAOFee: number;
}
export interface DAOConfig {
  multisigDAOFeeConfig: DAOConfigDetails;
  ftDAOFeeConfig: DAOConfigDetails;
  nftDAOFeeConfig: DAOConfigDetails;
}

export enum DAOTabs {
  All = "All",
  MyDAOs = "My DAOs",
}
