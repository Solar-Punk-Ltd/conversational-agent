import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { Bee, FileUploadOptions } from "@ethersphere/bee-js";
import { z } from "zod";
import { promisify } from "util";
import fs from "fs";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getUploadPostageBatchId,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS, DEFERRED_UPLOAD_SIZE_THRESHOLD_MB, GATEWAY_TAG_ERROR_MESSAGE, NOT_FOUND_STATUS } from "../constants";

const UploadFileSchema = z.object({
  data: z.string(),
  isPath: z.boolean(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export class UploadFileTool extends BaseHederaQueryTool<typeof UploadFileSchema> {
  name = "swarm-upload-file";
  description = `Upload a file to Swarm. Optional options (ignore if they are not requested): 
            isPath: wether the data parameter is a path.
            redundancyLevel: redundancy level for fault tolerance. Optional, value is 0 if not requested.
            postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.`;
  namespace = "swarm";
  specificInputSchema = UploadFileSchema;
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
      input: z.infer<typeof UploadFileSchema>
  ): Promise<ToolResponse | string> {
    const { data, isPath, redundancyLevel: inputRedundancyLevel, postageBatchId: inputPostageBatchId  } = input;

    if (!data) {
      return "Missing required parameter: data.";
    }

    const postageBatchId = await getUploadPostageBatchId(
      inputPostageBatchId,
      this.bee
    );

    let binaryData: Buffer;
    let name: string | undefined;

    if (isPath) {
      // Check if in stdio mode for file path uploads
      // if (!(transport instanceof StdioServerTransport)) {
      //   return "File path uploads are only supported in stdio mode.";
      // }

      // Read file from path
      try {
        binaryData = await promisify(fs.readFile)(data);
      } catch (fileError) {
        return `Unable to read file at path: ${data}.`;
      }

      name = data.split("/").pop();
    } else {
      binaryData = Buffer.from(data, "base64");
    }

    const redundancyLevel = inputRedundancyLevel;
    const options: FileUploadOptions = {};
    const deferredUploadSizeThreshold = Number(process.env.DEFERRED_UPLOAD_SIZE_THRESHOLD_MB) ||
      DEFERRED_UPLOAD_SIZE_THRESHOLD_MB;
    const deferred =
      binaryData.length > deferredUploadSizeThreshold * 1024 * 1024;
    options.deferred = deferred;
    if (redundancyLevel) {
      options.redundancyLevel = redundancyLevel;
    }

    let message = "File successfully uploaded to Swarm";
    let tagId: string | undefined = undefined;
    // Create tag for deferred uploads or when explicitly requested
    if (deferred) {
      try {
        const tag = await this.bee.createTag();
        options.tag = tag.uid;
        tagId = tag.uid.toString();
        message =
          "File upload started in deferred mode. Use query_upload_progress to track progress.";
      } catch (error) {
        if (errorHasStatus(error, NOT_FOUND_STATUS)) {
          console.log(GATEWAY_TAG_ERROR_MESSAGE);
        }
      }
    }

    let result;

    try {
      // Start the deferred upload
      result = await this.bee.uploadFile(postageBatchId, binaryData, name, options);
    } catch (error) {
      if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        return getErrorMessage(error);
      } else {
        return "Unable to upload file.";
      }
    }

    return JSON.stringify(getResponseWithStructuredContent({
      reference: result.reference.toString(),
      url: this.bee.url + "/bzz/" + result.reference.toString(),
      message,
      tagId,
    }));
  }
}
