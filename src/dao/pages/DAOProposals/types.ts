import { TokenBalance } from "@dex/hooks";
import { UploadedFile } from "@shared/ui-kit";
import { AbiInternalType } from "abitype";

export enum DAOProposalType {
  Text = "Text",
  TokenAssociate = "Token Associate",
  TokenTransfer = "Token Transfer",
  UpgradeThreshold = "Upgrade Threshold",
  AddMember = "Add Member",
  ReplaceMember = "Replace Member",
  RemoveMember = "Remove Member",
  Generic = "Generic",
  RiskParametersProposal = "Set risk parameters",
  AddTradingPairProposal = "Add a trading pair",
  RemoveTradingPairProposal = "Remove a trading pair",
  BuybackAndBurnProposal = "Buy back and burn",
}

export interface CreateDAOProposalFormBase {
  title: string;
  description: string;
  type: DAOProposalType;
}

export interface CreateDAOTextProposalForm extends CreateDAOProposalFormBase {
  linkToDiscussion: string;
  nftTokenSerialId: number;
  metadata: string;
}

export interface CreateDAOTokenTransferForm extends CreateDAOProposalFormBase {
  recipientAccountId: string;
  linkToDiscussion: string;
  tokenType: string;
  tokenId: string;
  amount: string | undefined;
  decimals: number;
  nftSerialId: number;
  governanceNftTokenSerialId: number;
}

export interface CreateDAOTokenAssociateForm extends CreateDAOProposalFormBase {
  tokenId: string;
  linkToDiscussion: string;
  nftTokenSerialId: number;
}

export interface CreateDAOMemberOperationForm extends CreateDAOProposalFormBase {
  memberAddress: string;
  newThreshold: number;
  newMemberAddress: string;
}

export interface CreateDAOUpgradeThresholdForm extends CreateDAOProposalFormBase {
  newThreshold: number;
}

export interface CreateDAOContractUpgradeForm extends CreateDAOProposalFormBase {
  linkToDiscussion: string;
  newImplementationAddress: string;
  oldProxyAddress: string;
  proxyAdmin: string;
  nftTokenSerialId?: number;
}

type ResolvedAbiType = string;

export type Argument = StandardArgument | TupleArgument;

export type StandardArgument = {
  type: ResolvedAbiType;
  transformedValue: any | undefined;
} & BaseArgumentFields;

export type TupleArgument = {
  type: "tuple" | `tuple[${string}]`;
  components: readonly Argument[];
} & BaseArgumentFields;

type BaseArgumentFields = {
  name?: string | undefined;
  internalType?: AbiInternalType | undefined;
  inputValue: string;
  transformedValue: any | undefined;
};

export interface CreateDAOGenericProposalForm extends CreateDAOProposalFormBase {
  linkToDiscussion: string;
  targetContractId: string;
  abiFile: UploadedFile;
  functionName: string;
  functionArguments: Argument[];
  encodedFunctionData: string;
}

export interface WhitelistPairInput {
  tokenA: string;
  tokenB: string;
}

export interface BuybackAndBurnInput {
  tokenIn: string;
  pathToQuote: string;
  amountIn: string;
  minQuoteOut: string;
  minAmountOut: string;
  maxHtkPriceD18: string;
  deadline: string;
}

export interface CreateDAODexSettingsForm extends CreateDAOProposalFormBase {
  maxTradeBps: number | undefined;
  maxSlippageBps: number | undefined;
  tradeCooldownSec: number | undefined;
  whitelistAdd: WhitelistPairInput[];
  whitelistRemove: WhitelistPairInput[];
  buybackAndBurnData: BuybackAndBurnInput;
  linkToDiscussion?: string;
}

export type CreateDAOProposalForm =
  | CreateDAOTextProposalForm
  | CreateDAOTokenTransferForm
  | CreateDAOMemberOperationForm
  | CreateDAOUpgradeThresholdForm
  | CreateDAOContractUpgradeForm
  | CreateDAOTokenAssociateForm
  | CreateDAOGenericProposalForm
  | CreateDAODexSettingsForm;
