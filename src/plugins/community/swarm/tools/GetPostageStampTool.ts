import {
  type GenericPluginContext,
  BaseHederaQueryTool,
  type HederaAgentKit,
} from "hedera-agent-kit";
import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import {
  PostageBatchCurated,
  PostageBatchSummary,
  ResponseContent,
} from "../model";
import {
  errorHasStatus,
  getBatchSummary,
  getResponseWithStructuredContent,
  ToolResponse,
} from "../utils";
import { GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS } from "../constants";

const GetPostageStampSchema = z.object({
  postageBatchId: z.string(),
});

export class GetPostageStampTool extends BaseHederaQueryTool<typeof GetPostageStampSchema> {
  name = "swarm-get-postage-stamp";
  description = "Get a specific postage stamp based on postageBatchId.";
  namespace = "swarm";
  specificInputSchema = GetPostageStampSchema;
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
      input: z.infer<typeof GetPostageStampSchema>
  ): Promise<ToolResponse | string> {
    const { postageBatchId } = input;
    if (!postageBatchId) {
      return "Missing required parameter: postageBatchId";
    }

    let rawPostageBatch;

    try {
      rawPostageBatch = await this.bee.getPostageBatch(postageBatchId);
    } catch (error) {
      if (errorHasStatus(error, NOT_FOUND_STATUS)) {
        return GATEWAY_STAMP_ERROR_MESSAGE;
      } else {
        return "Retrieval of postage batch failed.";
      }
    }

    const batch: PostageBatchCurated = {
      ...rawPostageBatch,
      batchID: rawPostageBatch.batchID.toHex(),
    };
    const batchSummary: PostageBatchSummary = getBatchSummary(rawPostageBatch);

    const content: ResponseContent<PostageBatchCurated, PostageBatchSummary> = {
      raw: batch,
      summary: batchSummary,
    };

    return getResponseWithStructuredContent(content);
  }
}
