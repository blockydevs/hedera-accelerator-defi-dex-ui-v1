import { HashConnectSigner } from "hashconnect/dist/signer";
import {
  ContractId,
  ContractExecuteTransaction,
  TransactionResponse,
  TokenMintTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { NFTDAOContractFunctions } from "./types";
import { checkTransactionResponseForError } from "@dex/services";
import { NFTDAOFunctions } from "../types";

interface MintNFTTokensTransactionParams {
  tokenLinks: string[];
  tokenId: string;
  signer: HashConnectSigner;
}

async function sendMintNFTTokensTransaction(params: MintNFTTokensTransactionParams): Promise<TransactionResponse> {
  const { tokenId, tokenLinks, signer } = params;
  const data = tokenLinks.map((link) => Buffer.from(link));
  const mintNFTTokensTransaction = await new TokenMintTransaction()
    .setMaxTransactionFee(10)
    .setTokenId(tokenId)
    .setMetadata(data)
    .freezeWithSigner(signer);
  const mintNFTTokensResponse = await mintNFTTokensTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(mintNFTTokensResponse, NFTDAOContractFunctions.MintTokens);
  return mintNFTTokensResponse;
}

interface SendLockNFTTokenTransactionParams {
  nftSerialId: number;
  spenderContractId: string;
  signer: HashConnectSigner;
}

const sendLockNFTTokenTransaction = async (params: SendLockNFTTokenTransactionParams) => {
  const { nftSerialId, signer, spenderContractId } = params;
  const godHolderContractId = ContractId.fromString(spenderContractId);
  const contractFunctionParameters = new ContractFunctionParameters().addUint256(nftSerialId);
  const executeSendLockGODTokenTransaction = await new ContractExecuteTransaction()
    .setContractId(godHolderContractId)
    .setFunction(NFTDAOFunctions.GrabTokensFromUser, contractFunctionParameters)
    .setGas(900000)
    .freezeWithSigner(signer);
  const sendLockGODTokenResponse = await executeSendLockGODTokenTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(sendLockGODTokenResponse, NFTDAOFunctions.GrabTokensFromUser);
  return sendLockGODTokenResponse;
};

interface SendUnLockNFTTokenTransactionParams {
  tokenHolderAddress: string;
  signer: HashConnectSigner;
}

const sendUnLockNFTTokenTransaction = async (params: SendUnLockNFTTokenTransactionParams) => {
  const { signer, tokenHolderAddress } = params;
  const godHolderContractId = ContractId.fromString(tokenHolderAddress);
  const contractFunctionParameters = new ContractFunctionParameters().addUint256(0);
  const executeSendUnLockGODTokenTransaction = await new ContractExecuteTransaction()
    .setContractId(godHolderContractId)
    .setFunction(NFTDAOFunctions.RevertTokensForVoter, contractFunctionParameters)
    .setGas(900000)
    .freezeWithSigner(signer);
  const sendUnLockGODTokenResponse = await executeSendUnLockGODTokenTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(sendUnLockGODTokenResponse, NFTDAOFunctions.RevertTokensForVoter);
  return sendUnLockGODTokenResponse;
};

export { sendMintNFTTokensTransaction, sendLockNFTTokenTransaction, sendUnLockNFTTokenTransaction };
