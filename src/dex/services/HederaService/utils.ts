import { TransactionResponse, TransactionReceipt } from "@hashgraph/sdk";
import { isNil } from "ramda";

const checkTransactionResponseForError = (response: TransactionResponse | TransactionReceipt, functionName: string) => {
  if (isNil(response)) throw new Error(`${functionName} transaction failed.`);
};

export { checkTransactionResponseForError };
