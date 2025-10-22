import {
  BaseHederaQueryTool,
  HederaAgentKit,
  type GenericPluginContext,
} from "hedera-agent-kit";
import { Bee } from "@ethersphere/bee-js";
import { z } from "zod";
import crypto from "crypto";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getUploadPostageBatchId,
  hexToBytes,
  ToolResponse,
} from "../utils";
import { BAD_REQUEST_STATUS } from "../constants";
import { Wallet } from "@ethereumjs/wallet";

const UpdateFeedSchema = z.object({
  data: z.string(),
  memoryTopic: z.string(),
  postageBatchId: z.string().optional(),
});

export class UpdateFeedTool extends BaseHederaQueryTool<typeof UpdateFeedSchema> {
  name = "swarm-update-feed";
  description = `Update the feed of a given topic with new data. Optional options (ignore if they are not requested):
    postageBatchId: The postage stamp batch ID which will be used to perform the upload, if it is provided.`;
  namespace = "swarm";
  specificInputSchema = UpdateFeedSchema;
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
      input: z.infer<typeof UpdateFeedSchema>
  ): Promise<ToolResponse | string> {
    const { data, memoryTopic, postageBatchId: inputPostageBatchId  } = input;
    
     if (!data) {
      return "Missing required parameter: data.";
    } else if (!memoryTopic) {
      return "Missing required parameter: topic.";
    }

    const postageBatchId = await getUploadPostageBatchId(
      inputPostageBatchId,
      this.bee
    );

    const binaryData = Buffer.from(data);

    // Feed upload if memoryTopic is specified
    if (!process.env.SWARM_BEE_FEED_PK) {
      this.logger.error("Feed private key not configured. Set BEE_FEED_PK environment variable.");
      return "Feed private key not configured. Set BEE_FEED_PK environment variable.";
    }

    // Process topic - if not a hex string, hash it
    let topic = memoryTopic;
    if (topic.startsWith("0x")) {
      topic = topic.slice(2);
    }
    const isHexString = /^[0-9a-fA-F]{64}$/.test(memoryTopic);

    if (!isHexString) {
      // Hash the topic string using SHA-256
      const hash = crypto
        .createHash("sha256")
        .update(memoryTopic)
        .digest("hex");
      topic = hash;
    }

    // Convert topic string to bytes
    const topicBytes = hexToBytes(topic);

    const feedPrivateKey = hexToBytes(process.env.SWARM_BEE_FEED_PK);
    const signer = new Wallet(feedPrivateKey);
    const owner = signer.getAddressString().slice(2);

    let result;

    try {
      const feedWriter = this.bee.makeFeedWriter(topicBytes, feedPrivateKey);

      result = await feedWriter.uploadPayload(postageBatchId!, binaryData);
    } catch (error) {
      if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
        return getErrorMessage(error);
      } else {
        return "Unable to update feed.";
      }
    }

    const reference = result.reference.toString();

    return getResponseWithStructuredContent({
      reference,
      topicString: memoryTopic,
      topic: topic,
      feedUrl: `${this.bee.url}/feeds/${owner}/${topic}`,
      message: "Data successfully uploaded to Swarm and linked to feed.",
    });
  }
}
