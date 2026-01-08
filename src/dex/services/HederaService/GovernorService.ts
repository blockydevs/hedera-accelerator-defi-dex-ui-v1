import { BigNumber } from "bignumber.js";
import { ContractExecuteTransaction, ContractFunctionParameters, ContractId } from "@hashgraph/sdk";
import { GovernorContractFunctions } from "./types";
import { HashConnectSigner } from "hashconnect/dist/signer";
import { checkTransactionResponseForError } from "./utils";
import { Proposal } from "@dao/hooks";
import { DexService } from "@dex/services";
import { ethers } from "ethers";

/**
 * General format of service calls:
 * 1 - Convert data types.
 * 2 - Create contract parameters.
 * 3 - Create and sign transaction.
 * 4 - Send transaction to wallet and execute transaction.
 * 5 - Extract and return resulting data.
 */
interface CastVoteParams {
  contractId: string;
  proposalId: string;
  voteType: number;
  signer: HashConnectSigner;
}

const castVote = async (params: CastVoteParams) => {
  const { contractId, proposalId, voteType, signer } = params;
  const governorContractId = ContractId.fromString(contractId);
  const preciseProposalId = BigNumber(proposalId);
  const contractFunctionParameters = new ContractFunctionParameters().addUint256(preciseProposalId).addUint8(voteType);
  const abi = ["function castVote(uint256 proposalId, uint8 support)"];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(GovernorContractFunctions.CastVote, [preciseProposalId.toFixed(), voteType]);

  let estimatedGas: number | undefined;
  try {
    const gasUsed = await DexService.estimateContractGas({
      to: contractId,
      data,
      from: signer.getAccountId().toString(),
    });
    estimatedGas = Math.ceil(gasUsed * 1.1);
  } catch (error) {
    console.error("Gas estimation failed", error);
    estimatedGas = 1000000;
  }

  const castVoteTransaction = await new ContractExecuteTransaction()
    .setContractId(governorContractId)
    .setFunction(GovernorContractFunctions.CastVote, contractFunctionParameters)
    .setGas(estimatedGas)
    .freezeWithSigner(signer);
  const response = await castVoteTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(response, GovernorContractFunctions.CastVote);
  return response;
};

interface CancelProposalParams {
  contractId: string;
  proposal: Proposal;
  signer: HashConnectSigner;
}

const cancelProposal = async (params: CancelProposalParams) => {
  const { contractId, proposal, signer } = params;
  const governorContractId = ContractId.fromString(contractId);
  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddressArray(proposal.coreInformation?.inputs?.targets ?? [])
    .addUint256Array(proposal.coreInformation?.inputs?._values.map((value) => Number(value)) ?? [])
    .addBytesArray(
      proposal.coreInformation?.inputs?.calldatas?.map((item: string) => ethers.utils.arrayify(item)) ?? []
    )
    .addBytes32(stringToByetes32(proposal.title));
  const abi = ["function cancel(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash)"];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(GovernorContractFunctions.Cancel, [
    proposal.coreInformation?.inputs?.targets ?? [],
    proposal.coreInformation?.inputs?._values.map((value) => Number(value)) ?? [],
    proposal.coreInformation?.inputs?.calldatas?.map((item: string) => ethers.utils.arrayify(item)) ?? [],
    stringToByetes32(proposal.title),
  ]);

  let estimatedGas: number | undefined;
  try {
    const gasUsed = await DexService.estimateContractGas({
      to: contractId,
      data,
      from: signer.getAccountId().toString(),
    });
    estimatedGas = Math.ceil(gasUsed * 1.1);
  } catch (error) {
    console.error("Gas estimation failed", error);
    estimatedGas = 900000;
  }

  const cancelProposalTransaction = await new ContractExecuteTransaction()
    .setContractId(governorContractId)
    .setFunction(GovernorContractFunctions.Cancel, contractFunctionParameters)
    .setGas(estimatedGas)
    .freezeWithSigner(signer);
  const response = await cancelProposalTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(response, GovernorContractFunctions.Cancel);
  return response;
};

const stringToByetes32 = (input: string) => {
  const toUtf8Bytes = ethers.utils.toUtf8Bytes(input);
  const keccak256 = ethers.utils.keccak256(toUtf8Bytes);
  return ethers.utils.arrayify(keccak256);
};

interface SendClaimGODTokenTransactionParams {
  contractId: string;
  proposalId: string;
  signer: HashConnectSigner;
}

const sendClaimGODTokenTransaction = async (params: SendClaimGODTokenTransactionParams) => {
  const { contractId, proposalId, signer } = params;
  const preciseProposalId = BigNumber(proposalId);
  const governorContractId = ContractId.fromString(contractId);
  const contractFunctionParameters = new ContractFunctionParameters().addUint256(preciseProposalId);
  const abi = ["function claimGODToken(uint256 proposalId)"];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(GovernorContractFunctions.ClaimGODToken, [preciseProposalId.toFixed()]);

  let estimatedGas: number | undefined;
  try {
    const gasUsed = await DexService.estimateContractGas({
      to: contractId,
      data,
      from: signer.getAccountId().toString(),
    });
    estimatedGas = Math.ceil(gasUsed * 1.1);
  } catch (error) {
    console.error("Gas estimation failed", error);
    estimatedGas = 900000;
  }

  const executeClaimGODTokenTransaction = await new ContractExecuteTransaction()
    .setContractId(governorContractId)
    .setFunction(GovernorContractFunctions.ClaimGODToken, contractFunctionParameters)
    .setGas(estimatedGas)
    .freezeWithSigner(signer);
  const claimGODTokenresponse = await executeClaimGODTokenTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(claimGODTokenresponse, GovernorContractFunctions.ClaimGODToken);
  return claimGODTokenresponse;
};

interface SendLockGODTokenTransactionParams {
  tokenAmount: number;
  tokenHolderAddress: string;
  tokenDecimals: string;
  signer: HashConnectSigner;
}

const sendLockGODTokenTransaction = async (params: SendLockGODTokenTransactionParams) => {
  const { tokenAmount, signer, tokenHolderAddress, tokenDecimals } = params;
  const godHolderContractId = ContractId.fromString(tokenHolderAddress);
  const amount = BigNumber(tokenAmount).shiftedBy(Number(tokenDecimals));
  const contractFunctionParameters = new ContractFunctionParameters().addUint256(amount);
  const abi = ["function grabTokensFromUser(uint256 amount)"];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(GovernorContractFunctions.LockGODToken, [amount.toFixed()]);

  let estimatedGas: number | undefined;
  try {
    const gasUsed = await DexService.estimateContractGas({
      to: tokenHolderAddress,
      data,
      from: signer.getAccountId().toString(),
    });
    estimatedGas = Math.ceil(gasUsed * 1.1);
  } catch (error) {
    console.error("Gas estimation failed", error);
    estimatedGas = 900000;
  }

  const executeSendLockGODTokenTransaction = await new ContractExecuteTransaction()
    .setContractId(godHolderContractId)
    .setFunction(GovernorContractFunctions.LockGODToken, contractFunctionParameters)
    .setGas(estimatedGas)
    .freezeWithSigner(signer);
  const sendLockGODTokenResponse = await executeSendLockGODTokenTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(sendLockGODTokenResponse, GovernorContractFunctions.LockGODToken);
  return sendLockGODTokenResponse;
};

interface SendUnLockGODTokenTransactionParams {
  tokenAmount: number;
  tokenHolderAddress: string;
  tokenDecimals: string;
  signer: HashConnectSigner;
}

const sendUnLockGODTokenTransaction = async (params: SendUnLockGODTokenTransactionParams) => {
  const { tokenAmount, signer, tokenHolderAddress, tokenDecimals } = params;
  const godHolderContractId = ContractId.fromString(tokenHolderAddress);
  const amount = BigNumber(tokenAmount).shiftedBy(Number(tokenDecimals));
  const contractFunctionParameters = new ContractFunctionParameters().addUint256(amount);
  const abi = ["function revertTokensForVoter(uint256 amount)"];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(GovernorContractFunctions.UnLockGODToken, [amount.toFixed()]);

  let estimatedGas: number | undefined;
  try {
    const gasUsed = await DexService.estimateContractGas({
      to: tokenHolderAddress,
      data,
      from: signer.getAccountId().toString(),
    });
    estimatedGas = Math.ceil(gasUsed * 1.1);
  } catch (error) {
    console.error("Gas estimation failed", error);
    estimatedGas = 900000;
  }

  const executeSendUnLockGODTokenTransaction = await new ContractExecuteTransaction()
    .setContractId(godHolderContractId)
    .setFunction(GovernorContractFunctions.UnLockGODToken, contractFunctionParameters)
    .setGas(estimatedGas)
    .freezeWithSigner(signer);
  const sendUnLockGODTokenResponse = await executeSendUnLockGODTokenTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(sendUnLockGODTokenResponse, GovernorContractFunctions.UnLockGODToken);
  return sendUnLockGODTokenResponse;
};

interface ExecuteProposalParams {
  contractId: string;
  proposal: Proposal;
  signer: HashConnectSigner;
  transfersFromAccount?: string;
  transfersToAccount?: string;
  tokenId?: string;
  tokenAmount?: number;
}

const executeProposal = async (params: ExecuteProposalParams) => {
  const { contractId, proposal, signer, transfersFromAccount, tokenId, tokenAmount } = params;
  const governorContractId = ContractId.fromString(contractId);
  const targetContractAddress = proposal.coreInformation?.inputs.targets?.[0] || "0x";

  const preciseValues = proposal.coreInformation?.inputs?._values?.map((value) => Number(value)) ?? [];
  const preciseCalldatas =
    proposal.coreInformation?.inputs?.calldatas?.map((item: string) => ethers.utils.arrayify(item)) ?? [];
  const descriptionHash = stringToByetes32(proposal.title);

  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddressArray([targetContractAddress] ?? [])
    .addUint256Array(preciseValues)
    .addBytesArray(preciseCalldatas)
    .addBytes32(descriptionHash);

  if (tokenId && transfersFromAccount && tokenAmount) {
    await DexService.setTokenAllowance({
      tokenId,
      walletId: transfersFromAccount,
      spenderContractId: contractId,
      tokenAmount,
      signer: signer,
    });
  }

  const abi = ["function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash)"];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(GovernorContractFunctions.Execute, [
    [targetContractAddress],
    preciseValues,
    preciseCalldatas,
    descriptionHash,
  ]);

  let estimatedGas: number | undefined;
  try {
    const gasUsed = await DexService.estimateContractGas({
      to: contractId,
      data,
      from: signer.getAccountId().toString(),
    });
    estimatedGas = Math.ceil(gasUsed * 1.1);
  } catch (error) {
    console.error("Gas estimation failed", error);
    estimatedGas = 15000000;
  }

  const executeProposalTransaction = await new ContractExecuteTransaction()
    .setContractId(governorContractId)
    .setFunction(GovernorContractFunctions.Execute, contractFunctionParameters)
    .setGas(estimatedGas)
    .freezeWithSigner(signer);
  const executeTransactionResponse = await executeProposalTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(executeTransactionResponse, GovernorContractFunctions.Execute);
  return executeTransactionResponse;
};

const GovernorService = {
  sendClaimGODTokenTransaction,
  castVote,
  cancelProposal,
  executeProposal,
  sendLockGODTokenTransaction,
  sendUnLockGODTokenTransaction,
};

export default GovernorService;
