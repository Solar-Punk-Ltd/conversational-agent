import {
  type GenericPluginContext,
  BaseHederaQueryTool,
  type HederaAgentKit,
} from "hedera-agent-kit";
import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import {
  getResponseWithStructuredContent,
  ToolResponse,
} from "../utils";
import { GATEWAY_TAG_ERROR_MESSAGE } from "../constants";

const QueryUploadProgressSchema = z.object({
  tagId: z.string(),
});

export class QueryUploadProgressTool extends BaseHederaQueryTool<typeof QueryUploadProgressSchema> {
  name = "swarm-query-upload-progress";
  description = "Query upload progress for a specific upload session identified with the returned Tag ID";
  namespace = "swarm";
  specificInputSchema = QueryUploadProgressSchema;
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
      input: z.infer<typeof QueryUploadProgressSchema>
  ): Promise<ToolResponse | string> {
    if (!input?.tagId) {
      return "Missing required parameter: tagId";
    }

    const tagUid = Number.parseInt(input.tagId, 10);
    if (Number.isNaN(tagUid)) {
      return "Invalid tagId format. Expected a numeric string.";
    }

    try {
      const tag = await this.bee.retrieveTag(tagUid);

      const synced = tag.synced ?? 0;
      const seen = tag.seen ?? 0;
      const processed = synced + seen;
      const total = tag.split ?? 0;
      const startedAt = tag.startedAt;

      const processedPercentage =
        total > 0 ? Math.round((processed / total) * 100) : 0;
      const isComplete = processedPercentage === 100;

      let tagDeleted = false;
      if (isComplete) {
        try {
          await this.bee.deleteTag(tagUid);
          tagDeleted = true;
        } catch {
          // Non-fatal: if deletion fails we still return progress
        }
      }

      return getResponseWithStructuredContent({
        processedPercentage,
        message: isComplete
          ? "Upload completed successfully."
          : `Upload progress: ${processedPercentage}% processed`,
        startedAt,
        tagAddress: tag.address,
      });
    } catch (error: any) {
      const status = error?.status ?? error?.response?.status;
      if (status === 404) {
        return `Tag with ID ${input.tagId} does not exist or has been deleted. ` + GATEWAY_TAG_ERROR_MESSAGE;
      }

      return `Failed to retrieve upload progress: ${error?.message ?? "Unknown error"}`;
    }
  }
}
