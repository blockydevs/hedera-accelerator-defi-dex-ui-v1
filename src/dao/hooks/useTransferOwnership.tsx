import { UseMutationResult } from "react-query";
import { DAOMutations } from "./types";
import { TransactionResponse } from "@hashgraph/sdk";

export type UseTransferOwnershipMutationResult = UseMutationResult<
  TransactionResponse | undefined,
  Error,
  UseTransferOwnershipParams,
  DAOMutations.TransferOwnership
>;

interface UseTransferOwnershipParams {
  newOwnerEVMAddress: string;
  targetAddress: string;
}
