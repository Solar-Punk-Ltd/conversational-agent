import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { BatchId, Bee, Duration, Size } from "@ethersphere/bee-js";
import { z } from "zod";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  makeDate,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS, GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS } from "../constants";

const ExtendPostageStampSchema = z.object({
  postageBatchId: z.string(),
  duration: z.string().optional(),
  size: z.number().optional(),
});

export class ExtendPostageStampTool extends BaseHederaQueryTool<typeof ExtendPostageStampSchema> {
  name = "swarm-extend-postage-stamp";
  description = "Increase the duration (relative to current duration) or size (in megabytes) of a postage stamp.";
  namespace = "swarm";
  specificInputSchema = ExtendPostageStampSchema;
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
    input: z.infer<typeof ExtendPostageStampSchema>
  ): Promise<ToolResponse | string> {
    const { postageBatchId, duration, size } = input;

    if (!postageBatchId) {
      return "Missing required parameter: postageBatchId";
    } else if (!duration && !size) {
      return "You need at least one parameter from duration and size.";
    }

    const extendSize = !!size ? Size.fromMegabytes(size) : Size.fromBytes(1);
    let extendDuration = Duration.ZERO;

    try {
      if (duration) {
        extendDuration = Duration.fromMilliseconds(makeDate(duration));
      }
    } catch (makeDateError) {
      return "Invalid parameter: duration";
    }

    let extendStorageResponse;

    try {
      extendStorageResponse = await this.bee.extendStorage(
        postageBatchId,
        extendSize,
        extendDuration
      );
    } catch (error) {
      if (errorHasStatus(error, NOT_FOUND_STATUS)) {
        return GATEWAY_STAMP_ERROR_MESSAGE;
      } else if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        return getErrorMessage(error);
      } else {
        return "Extend failed.";
      }
    }

    return getResponseWithStructuredContent({
      postageBatchId: extendStorageResponse.toHex(),
    });
  }
}
