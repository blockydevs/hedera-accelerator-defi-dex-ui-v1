import { Flex } from "@chakra-ui/react";
import { NetworkSwitcher } from "@dex/components";

export function PageFooter() {
  return (
    <Flex layerStyle="footer" alignItems="flex-end" mt="5">
      <NetworkSwitcher />
    </Flex>
  );
}
