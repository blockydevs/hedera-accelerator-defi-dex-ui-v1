import { BigNumber } from "bignumber.js";
import { HashConnectSigner } from "hashconnect/dist/signer";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TransactionResponse,
  TransferTransaction,
} from "@hashgraph/sdk";
import { BaseDAOContractFunctions, MultiSigDAOContractFunctions } from "./types";
import { checkTransactionResponseForError } from "@dex/services/HederaService/utils";
import { ethers } from "ethers";
import { isHbarToken } from "@dex/utils";
import BaseDAOJSON from "@dex/services/abi/BaseDAO.json";

const Gas = 9000000;

interface SendProposeTransaction {
  safeEVMAddress: string;
  data: string;
  multiSigDAOContractId: string;
  title: string;
  description: string;
  linkToDiscussion?: string;
  metadata?: string;
  transactionType: number;
  hBarPayableValue?: number;
  signer: HashConnectSigner;
}

async function sendProposeTransaction(params: SendProposeTransaction) {
  const {
    safeEVMAddress,
    data,
    signer,
    multiSigDAOContractId,
    transactionType,
    title,
    description,
    metadata = "",
    hBarPayableValue,
    linkToDiscussion = "",
  } = params;
  const hBarAmount = hBarPayableValue ? hBarPayableValue : 0;
  const ownerData = ethers.utils.arrayify(data);
  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(safeEVMAddress)
    .addBytes(ownerData)
    .addUint256(transactionType)
    .addString(title)
    .addString(description)
    .addString(linkToDiscussion)
    .addString(metadata);

  const sendProposeTransaction = await new ContractExecuteTransaction()
    .setContractId(multiSigDAOContractId)
    .setFunction(MultiSigDAOContractFunctions.ProposeTransaction, contractFunctionParameters)
    .setGas(Gas)
    .setPayableAmount(hBarAmount)
    .freezeWithSigner(signer);
  const sendProposeTransactionResponse = await sendProposeTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(sendProposeTransactionResponse, MultiSigDAOContractFunctions.ProposeTransaction);
  return sendProposeTransactionResponse;
}

interface UpdateDAODetailsTransactionParams {
  name: string;
  description: string;
  logoUrl: string;
  infoUrl: string;
  webLinks: string[];
  daoAccountId: string;
  signer: HashConnectSigner;
}

async function sendUpdateDAODetailsTransaction(params: UpdateDAODetailsTransactionParams) {
  const { name, description, logoUrl, infoUrl, webLinks, daoAccountId, signer } = params;
  const contractInterface = new ethers.utils.Interface(BaseDAOJSON.abi);
  const updateDaoParams: any[] = [name, logoUrl, infoUrl, description, webLinks];
  const data = contractInterface.encodeFunctionData(BaseDAOContractFunctions.UpdateDAOInfo, updateDaoParams);
  const sendProposeUpdateDAODetailsTransaction = await new ContractExecuteTransaction()
    .setContractId(daoAccountId)
    .setFunctionParameters(ethers.utils.arrayify(data))
    .setGas(Gas)
    .freezeWithSigner(signer);
  const sendProposeUpdateDAODetailsResponse = await sendProposeUpdateDAODetailsTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(sendProposeUpdateDAODetailsResponse, BaseDAOContractFunctions.UpdateDAOInfo);
  return sendProposeUpdateDAODetailsResponse;
}

interface DepositTokensTransactionParams {
  safeId: string;
  tokenId: string;
  amount: number;
  decimals: number;
  isNFT: boolean;
  nftSerialId: number;
  signer: HashConnectSigner;
}

async function sendTokensTransaction(params: DepositTokensTransactionParams): Promise<TransactionResponse> {
  const { safeId, tokenId, amount, decimals, isNFT, nftSerialId, signer } = params;
  const walletId = signer.getAccountId().toString();
  const preciseAmount = BigNumber(amount).shiftedBy(decimals).toNumber();
  if (isNFT) {
    const depositTokensTransaction = await new TransferTransaction()
      .addNftTransfer(tokenId, nftSerialId, walletId, safeId)
      .freezeWithSigner(signer);
    const depositTokensResponse = await depositTokensTransaction.executeWithSigner(signer);
    checkTransactionResponseForError(depositTokensResponse, MultiSigDAOContractFunctions.DepositTokens);
    return depositTokensResponse;
  } else if (isHbarToken(tokenId)) {
    const depositTokensTransaction = await new TransferTransaction()
      .addHbarTransfer(walletId, -amount)
      .addHbarTransfer(safeId, amount)
      .freezeWithSigner(signer);
    const depositTokensResponse = await depositTokensTransaction.executeWithSigner(signer);
    checkTransactionResponseForError(depositTokensResponse, MultiSigDAOContractFunctions.DepositTokens);
    return depositTokensResponse;
  } else {
    const depositTokensTransaction = await new TransferTransaction()
      .addTokenTransfer(tokenId, walletId, -preciseAmount)
      .addTokenTransfer(tokenId, safeId, preciseAmount)
      .freezeWithSigner(signer);
    const depositTokensResponse = await depositTokensTransaction.executeWithSigner(signer);
    checkTransactionResponseForError(depositTokensResponse, MultiSigDAOContractFunctions.DepositTokens);
    return depositTokensResponse;
  }
}

export { sendProposeTransaction, sendUpdateDAODetailsTransaction, sendTokensTransaction };
