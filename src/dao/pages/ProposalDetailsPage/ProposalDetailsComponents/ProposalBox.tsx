import { Flex } from "@chakra-ui/react";
import { Text, Color } from "@shared/ui-kit";

interface ProposalBoxProps {
  lines: string[];
}

export function ProposalBox(props: ProposalBoxProps) {
  const { lines } = props;
  if (!lines || lines.length === 0) return null;

  return (
    <Flex direction="column" gap="2">
      <Text.P_Medium_Medium color={Color.Grey_Blue._800}>Proposal</Text.P_Medium_Medium>
      <Flex layerStyle="content-box" direction="column" gap="2">
        {lines.map((l, idx) => (
          <Text.P_Small_Regular color={Color.Neutral._700} key={idx}>
            {l}
          </Text.P_Small_Regular>
        ))}
      </Flex>
    </Flex>
  );
}
