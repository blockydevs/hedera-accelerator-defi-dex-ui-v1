import { HashConnectSigner } from "hashconnect/dist/signer";
import { BigNumber } from "bignumber.js";
import {
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  TransactionResponse,
} from "@hashgraph/sdk";
import { Contracts, TREASURY_ID } from "../constants";
import { PairContractFunctions } from "./types";
import GovernorService from "./GovernorService";
import TokenService from "./TokenService";
import DAOService from "../../../dao/services/contracts";

type HederaServiceType = ReturnType<typeof createHederaService>;

/**
 * General format of service calls:
 * 1 - Convert data types.
 * 2 - Create contract parameters.
 * 3 - Create and sign transaction.
 * 4 - Send transaction to wallet and execute transaction.
 * 5 - Extract and return resulting data.
 */

function createHederaService() {
  let _precision = BigNumber(100000000);
  const initHederaService = async () => {
    // Since the Precision if fixed from Backend keeping it constant for a while.
    _precision = BigNumber(100000000);
  };

  const getPrecision = () => {
    return _precision;
  };

  interface AddLiquidityParams {
    firstTokenAddress: string;
    firstTokenQuantity: BigNumber;
    secondTokenAddress: string;
    secondTokenQuantity: BigNumber;
    addLiquidityContractAddress: ContractId;
    HbarAmount: BigNumber | number;
    /** Duration the transaction is valid for in seconds. Default is 120 seconds. */
    transactionDeadline: number;
    walletAddress: string;
    signer: HashConnectSigner;
  }

  async function addLiquidity(params: AddLiquidityParams): Promise<TransactionResponse> {
    const addLiquidityTransaction = await new ContractExecuteTransaction()
      .setContractId(params.addLiquidityContractAddress)
      .setGas(9000000)
      .setFunction(
        "addLiquidity",
        new ContractFunctionParameters()
          .addAddress(params.walletAddress)
          .addAddress(params.firstTokenAddress)
          .addAddress(params.secondTokenAddress)
          .addUint256(params.firstTokenQuantity)
          .addUint256(params.secondTokenQuantity)
      )
      .setPayableAmount(new Hbar(params.HbarAmount))
      .setTransactionValidDuration(params.transactionDeadline)
      .freezeWithSigner(params.signer);
    const transactionResponse = addLiquidityTransaction.executeWithSigner(params.signer);
    return transactionResponse;
  }

  interface RemoveLiquidityParams {
    /** Duration the transaction is valid for in seconds. Default is 120 seconds. */
    transactionDeadline: number;
    lpTokenAmount: BigNumber;
    signer: HashConnectSigner;
    contractId: ContractId;
  }

  const removeLiquidity = async (params: RemoveLiquidityParams): Promise<TransactionResponse> => {
    const accountId = params.signer.getAccountId().toSolidityAddress();
    const contractFunctionParams = new ContractFunctionParameters()
      .addAddress(accountId)
      .addUint256(params.lpTokenAmount);
    const removeLiquidity = await new ContractExecuteTransaction()
      .setContractId(params.contractId)
      .setGas(5000000)
      .setFunction(PairContractFunctions.RemoveLiquidity, contractFunctionParams)
      .setTransactionValidDuration(params.transactionDeadline)
      .freezeWithSigner(params.signer);

    return await removeLiquidity.executeWithSigner(params.signer);
  };

  interface SwapTokenParams {
    contractId: ContractId;
    walletAddress: string;
    tokenToTradeAddress: string;
    tokenToTradeAmount: BigNumber;
    slippageTolerance: BigNumber;
    /** Duration the transaction is valid for in seconds. Default is 120 seconds. */
    transactionDeadline: number;
    HbarAmount: number;
    signer: HashConnectSigner;
  }

  async function swapToken(params: SwapTokenParams): Promise<TransactionResponse> {
    const contractFunctionParams = new ContractFunctionParameters()
      .addAddress(params.walletAddress)
      .addAddress(params.tokenToTradeAddress)
      .addUint256(params.tokenToTradeAmount)
      .addUint256(params.slippageTolerance);
    const swapTokenTransaction = await new ContractExecuteTransaction()
      .setContractId(params.contractId)
      .setFunction(PairContractFunctions.SwapToken, contractFunctionParams)
      .setGas(9000000)
      .setPayableAmount(new Hbar(params.HbarAmount))
      .setTransactionValidDuration(params.transactionDeadline)
      .freezeWithSigner(params.signer);
    return await swapTokenTransaction.executeWithSigner(params.signer);
  }

  interface CreatePoolDetails {
    firstTokenAddress: string;
    secondTokenAddress: string;
    transactionFee: BigNumber;
    transactionDeadline: number;
    walletAddress: string;
    signer: HashConnectSigner;
  }

  const createPool = async (createPoolDetails: CreatePoolDetails): Promise<TransactionResponse> => {
    const factoryContractId = ContractId.fromString(Contracts.Factory.ProxyId);
    const { firstTokenAddress, secondTokenAddress, transactionFee, transactionDeadline, signer } = createPoolDetails;
    const createPoolTransaction = await new ContractExecuteTransaction()
      .setContractId(factoryContractId)
      .setGas(9000000)
      .setFunction(
        PairContractFunctions.CreatePair,
        new ContractFunctionParameters()
          .addAddress(firstTokenAddress)
          .addAddress(secondTokenAddress)
          .addAddress(ContractId.fromString(TREASURY_ID).toSolidityAddress())
          .addUint256(transactionFee)
      )
      .setMaxTransactionFee(new Hbar(100))
      .setPayableAmount(new Hbar(100))
      .setNodeAccountIds([new AccountId(3)])
      .setTransactionValidDuration(transactionDeadline)
      .freezeWithSigner(signer);
    return createPoolTransaction.executeWithSigner(signer);
  };

  return {
    initHederaService,
    getPrecision,
    swapToken,
    addLiquidity,
    removeLiquidity,
    createPool,
    ...GovernorService,
    ...TokenService,
    ...DAOService,
  };
}

export { createHederaService };
export type { HederaServiceType };
