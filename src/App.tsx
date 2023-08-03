import {
  MantineProvider,
  Text,
  Container,
  Center,
  Space,
  Button,
  Stack,
  Image,
} from "@mantine/core";
import icon from "/icons/icon-48.png";

export default function App() {
  return (
    <MantineProvider withGlobalStyles withNormalizeCSS>
      <Container sx={{ width: "300px", height: "200px" }}>
        <Space h="xl" />
        <Center>
          <Stack>
            <Center>
              <Image src={icon} width={50} />
            </Center>
            <Text size="xl" weight={700}>
              Salesforce Improved
            </Text>

            <Button>Settings</Button>
          </Stack>
        </Center>
        <Space h="xl" />
      </Container>
    </MantineProvider>
  );
}
