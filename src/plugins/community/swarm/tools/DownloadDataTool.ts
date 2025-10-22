import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import { getResponseWithStructuredContent, ToolResponse } from "../utils";
import { BaseHederaQueryTool, GenericPluginContext, HederaAgentKit } from "hedera-agent-kit";

const DownloadDataSchema = z.object({
  reference: z.string(),
});

export class DownloadDataTool extends BaseHederaQueryTool<typeof DownloadDataSchema> {
  name = "swarm-download-data";
  description = "Downloads immutable data from a Swarm content address hash.";
  namespace = "swarm";
  specificInputSchema = DownloadDataSchema;
  bee: Bee;

  constructor(params: {
    hederaKit: HederaAgentKit;
    logger?: GenericPluginContext['logger'];
    bee: Bee;
  }) {
    const { bee, ...rest } = params;
    super(rest);
    this.bee = bee;
  }

  protected async executeQuery(
      input: z.infer<typeof DownloadDataSchema>
  ): Promise<ToolResponse | string> {
    const { reference } = input;

    if (!reference) {
      return "Missing required parameter: reference";
    }

    const isRefNotSwarmHash =
      reference.length !== 64 && reference.length !== 66;

    if (isRefNotSwarmHash) {
      return "Invalid Swarm content address hash value for reference.";
    }

    const data = await this.bee.downloadData(reference);
    const textData = data.toUtf8();

    return getResponseWithStructuredContent({
      textData,
    });
  }
}
