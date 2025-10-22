import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { Bee, CollectionUploadOptions } from "@ethersphere/bee-js";
import { z } from "zod";
import { promisify } from "util";
import fs from "fs";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getUploadPostageBatchId,
} from "../utils";
import { BAD_REQUEST_STATUS } from "../constants";

const UploadFolderSchema = z.object({
  folderPath: z.string(),
  redundancyLevel: z.number().optional(),
  postageBatchId: z.string().optional(),
});

export class UploadFolderTool extends BaseHederaQueryTool<typeof UploadFolderSchema> {
  name = "swarm-upload-folder";
  description = `Upload a folder to Swarm. Optional options (ignore if they are not requested): 
      folderPath: path to the folder to upload. 
      redundancyLevel: redundancy level for fault tolerance. Optional, value is 0 if not requested. 
      postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.`;
  namespace = "swarm";
  specificInputSchema = UploadFolderSchema;
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
      input: z.infer<typeof UploadFolderSchema>
  ): Promise<string> {
    const { folderPath, redundancyLevel: inputRedundancyLevel, postageBatchId: inputPostageBatchId } = input;

    if (!folderPath) {
      return "Missing required parameter: folderPath.";
    }

    // // Check if in stdio mode for folder path uploads
    // if (!(transport instanceof StdioServerTransport)) {
    //   return "Folder path uploads are only supported in stdio mode.";
    // }

    // Check if folder exists
    const stats = await promisify(fs.stat)(folderPath);
    if (!stats.isDirectory()) {
      return `Path is not a directory: ${folderPath}.`;
    }

    const postageBatchId = await getUploadPostageBatchId(
      inputPostageBatchId,
      this.bee
    );

    const redundancyLevel = inputRedundancyLevel;
    const options: CollectionUploadOptions = {};

    if (redundancyLevel) {
      options.redundancyLevel = redundancyLevel;
    }

    const deferred = true;
    options.deferred = deferred;
    let message = "Folder successfully uploaded to Swarm";

    let tagId: string | undefined = undefined;
    if (deferred) {
      try {
        const tag = await this.bee.createTag();
        tagId = tag.uid.toString();
        options.tag = tag.uid;
        message =
          "Folder upload started in deferred mode. Use query_upload_progress to track progress.";
      } catch (error) {
        this.logger.error(`Failed to create tag: ${error}`);
        options.deferred = false;
      }
    }

    let result;

    try {
      // Start the deferred upload
      result = await this.bee.uploadFilesFromDirectory(
        postageBatchId,
        folderPath,
        options
      );
    } catch (error) {
      if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        return getErrorMessage(error);
      } else {
        return "Unable to upload folder.";
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
