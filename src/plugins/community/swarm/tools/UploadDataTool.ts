import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getUploadPostageBatchId,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS } from "../constants";

const UploadDataSchema = z.object({
  data: z.string(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export class UploadDataTool extends BaseHederaQueryTool<typeof UploadDataSchema> {
  name = "swarm-upload-data";
  description =
    "Upload text data to Swarm. Optional options (ignore if they are not requested): " +
    "redundancyLevel: redundancy level for fault tolerance. Optional, value is 0 if not requested. " +
    "postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.";
  namespace = "swarm";
  specificInputSchema = UploadDataSchema;
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
      input: z.infer<typeof UploadDataSchema>
  ): Promise<ToolResponse | string> {
    const { data, redundancyLevel, postageBatchId: inputPostageBatchId } = input;

    if (!data) {
      return "Missing required parameter: data.";
    }

    const postageBatchId = await getUploadPostageBatchId(
      inputPostageBatchId,
      this.bee
    );

    const binaryData = Buffer.from(data);

    const options = redundancyLevel ? { redundancyLevel } : undefined;

    let result;

    try {
      result = await this.bee.uploadData(postageBatchId, binaryData, options);
    } catch (error) {
      this.logger.error("UploadDataTool failed", error);

      return `Upload data error message: ${JSON.stringify(error)}`;

      if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        return getErrorMessage(error);
      } else {
        return "Unable to upload data.";
      }
    }

    return JSON.stringify(
      getResponseWithStructuredContent({
        reference: result.reference.toString(),
        url: this.bee.url + "/bytes/" + result.reference.toString(),
        message: "Data successfully uploaded to Swarm",
      })
    );
  }

}
