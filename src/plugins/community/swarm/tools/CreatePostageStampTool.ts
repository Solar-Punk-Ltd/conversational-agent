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
  makeDate,
  runWithTimeout,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS, CALL_TIMEOUT, GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS, POSTAGE_CREATE_TIMEOUT_MESSAGE } from "../constants";

const CreatePostageStampSchema = z.object({
  size: z.number(),
  duration: z.string(),
  label: z.string().optional(),
});

export class CreatePostageStampTool extends BaseHederaQueryTool<typeof CreatePostageStampSchema> {
  name = "swarm-create-postage-stamp";
  description = "Buy postage stamp based on size in megabytes and duration.";
  namespace = "swarm";
  specificInputSchema = CreatePostageStampSchema;
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
      input: z.infer<typeof CreatePostageStampSchema>
  ): Promise<ToolResponse | string> {
    const { size, duration, label } = input;

    if (!size) {
      return "Missing required parameter: size.";
    } else if (!duration) {
      return "Missing required parameter: duration.";
    }

    let durationMs;

    try {
      durationMs = makeDate(duration);
    } catch (makeDateError) {
      return "Invalid parameter: duration";
    }

    let buyStorageResponse: BatchId;

    try {
      const buyStoragePromise = this.bee.buyStorage(
        Size.fromMegabytes(size),
        Duration.fromMilliseconds(durationMs),
        {
          label: label || "",
        }
      );
      const [response, hasTimedOut] = await runWithTimeout(
        buyStoragePromise,
        CALL_TIMEOUT
      );

      if (hasTimedOut) {
        return JSON.stringify({
          content: [
            {
              type: "text",
              text: POSTAGE_CREATE_TIMEOUT_MESSAGE,
            },
          ],
        });
      }

      buyStorageResponse = response as BatchId;
    } catch (error) {
      if (errorHasStatus(error, NOT_FOUND_STATUS)) {
        return GATEWAY_STAMP_ERROR_MESSAGE;
      } else if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        return getErrorMessage(error);
      } else {
        return "Unable to buy storage.";
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Postage batch ID: ${buyStorageResponse.toHex()}`,
        },
      ],
    };
  }
}
