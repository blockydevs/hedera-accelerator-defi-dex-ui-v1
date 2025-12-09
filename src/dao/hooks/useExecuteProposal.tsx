import { UseMutationResult } from "react-query";
import { DAOMutations } from "./types";
import { TransactionResponse } from "@hashgraph/sdk";

export type UseExecuteProposalMutationResult = UseMutationResult<
  TransactionResponse | undefined,
  Error,
  UseExecuteProposalParams,
  DAOMutations.ExecuteProposal
>;
interface UseExecuteProposalParams {
  safeAccountId: string;
  to: string;
  msgValue: number;
  hexStringData: string;
  operation: number;
  nonce: number;
}
