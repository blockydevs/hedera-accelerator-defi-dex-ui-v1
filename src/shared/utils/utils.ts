import { TokenType, TokenId, AccountId, LedgerId } from "@hashgraph/sdk";

export const devDomains = ["dao.web3nomad.org", "localhost"];

export const halfOf = (amount: number) => amount / 2;

export const isNFT = (tokenType: string = "") => {
  return tokenType === TokenType.NonFungibleUnique.toString();
};

export const isFungible = (tokenType: string = "") => {
  return tokenType === TokenType.FungibleCommon.toString();
};

export const solidityAddressToTokenIdString = (address: string): string => {
  try {
    return TokenId.fromSolidityAddress(address).toString();
  } catch {
    return address;
  }
};

export const solidityAddressToAccountIdString = (address: string): string => {
  try {
    return AccountId.fromEvmAddress(0, 0, address).toString();
  } catch {
    return address;
  }
};

export function getDefaultLedgerId() {
  const isDevEnvironment = devDomains.includes(window.location.hostname);
  const storedNetwork =
    localStorage.getItem("activeNetwork") && LedgerId.fromString(localStorage.getItem("activeNetwork") as string);

  return storedNetwork || (isDevEnvironment ? LedgerId.TESTNET : LedgerId.MAINNET);
}
