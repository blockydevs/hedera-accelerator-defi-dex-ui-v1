import { ethers } from "ethers";
import { HashConnectSigner } from "hashconnect/dist/signer";
import { ContractExecuteTransaction } from "@hashgraph/sdk";
import { DexService, checkTransactionResponseForError } from "@dex/services";
import { DAOType, GovernorDAOContractFunctions, TokenType } from "@dao/services";
import HederaGovernorJSON from "@dex/services/abi/HederaGovernor.json";
import { isHbarToken } from "@dex/utils";
import { GovernanceProposalType } from "@dex/store";
import { isNotNil } from "ramda";

interface CreateProposalParams {
  governorContractId: string;
  proposalType: number;
  title: string;
  description: string;
  discussionLink: string;
  metadata: string;
  amountOrId: number;
  targets: string[];
  values: number[];
  calldatas: Uint8Array[];
  signer: HashConnectSigner;
}

const createProposal = async (params: CreateProposalParams) => {
  const {
    proposalType,
    title,
    description,
    discussionLink,
    metadata,
    amountOrId,
    targets,
    values,
    calldatas,
    governorContractId,
    signer,
  } = params;

  const createProposalInputs = {
    proposalType,
    title,
    description,
    discussionLink,
    metadata,
    amountOrId,
    targets,
    values,
    calldatas,
  };

  const contractInterface = new ethers.utils.Interface(HederaGovernorJSON.abi);
  const data = contractInterface.encodeFunctionData(GovernorDAOContractFunctions.CreateProposal, [
    Object.values(createProposalInputs),
  ]);

  const executeTransaction = await new ContractExecuteTransaction()
    .setContractId(governorContractId)
    .setFunctionParameters(ethers.utils.arrayify(data))
    .setGas(1000000)
    .freezeWithSigner(signer);
  const executeResponse = await executeTransaction.executeWithSigner(signer);
  checkTransactionResponseForError(executeResponse, GovernorDAOContractFunctions.CreateProposal);
  return executeResponse;
};

interface SetUpAllowanceParams {
  tokenId: string;
  nftSerialId: number;
  tokenAmount: number;
  tokenType?: string;
  spenderContractId: string;
  signer: HashConnectSigner;
}
async function setUpAllowance(params: SetUpAllowanceParams) {
  const { tokenId, spenderContractId, nftSerialId, signer, tokenAmount, tokenType } = params;
  const walletId = signer.getAccountId().toString();
  const {
    data: { type },
  } = isHbarToken(tokenId)
    ? { data: { type: TokenType.HBAR } }
    : isNotNil(tokenType)
    ? { data: { type: tokenType } }
    : await DexService.fetchTokenData(tokenId);

  switch (type) {
    case TokenType.HBAR: {
      return await DexService.setHbarTokenAllowance({
        walletId,
        spenderContractId,
        tokenAmount,
        signer,
      });
    }
    case TokenType.FungibleToken: {
      return await DexService.setTokenAllowance({
        tokenId,
        walletId,
        spenderContractId,
        tokenAmount,
        signer,
      });
    }
    case TokenType.NFT: {
      return await DexService.setNFTAllowance({
        tokenId,
        nftSerialId,
        walletId,
        spenderContractId,
        signer,
      });
    }
  }
}

interface CreateGovernanceProposalParams {
  governorContractId: string;
  governanceTokenId?: string;
  nftTokenSerialId?: number;
  daoType?: string;
  proposalType: number;
  title: string;
  description: string;
  discussionLink?: string;
  metadata?: string;
  amountOrId: number;
  target: string;
  calldata: string;
  signer: HashConnectSigner;
}

async function createGovernanceProposal(params: CreateGovernanceProposalParams) {
  const {
    governanceTokenId,
    signer,
    title,
    description,
    governorContractId,
    target,
    discussionLink = "",
    daoType,
    nftTokenSerialId = 0,
    calldata,
    proposalType,
    metadata = "",
    amountOrId = 0,
  } = params;

  if (governanceTokenId) {
    const tokenResponse = await DexService.mirrorNodeService.fetchTokenData(governanceTokenId);
    await setUpAllowance({
      tokenId: governanceTokenId,
      nftSerialId: nftTokenSerialId,
      spenderContractId: governorContractId,
      tokenAmount: tokenResponse.data.precision,
      tokenType: daoType === (DAOType as any).NFT ? TokenType.NFT : TokenType.FungibleToken,
      signer,
    });
  }

  const address = await DexService.mirrorNodeService.fetchContractEVMAddress(target);

  return await createProposal({
    proposalType,
    title,
    description,
    discussionLink,
    metadata,
    amountOrId,
    targets: [address],
    values: [0],
    calldatas: [ethers.utils.arrayify(calldata)],
    governorContractId,
    signer,
  });
}

async function sendHuffyRiskParametersProposal(params: any) {
  return createGovernanceProposal({ ...params, proposalType: GovernanceProposalType.RiskParametersProposal });
}

async function sendHuffyAddTradingPairProposal(params: any) {
  return createGovernanceProposal({ ...params, proposalType: GovernanceProposalType.AddTradingPairProposal });
}

async function sendHuffyRemoveTradingPairProposal(params: any) {
  return createGovernanceProposal({ ...params, proposalType: GovernanceProposalType.RemoveTradingPairProposal });
}

export {
  setUpAllowance,
  sendHuffyRiskParametersProposal,
  sendHuffyAddTradingPairProposal,
  sendHuffyRemoveTradingPairProposal,
};
