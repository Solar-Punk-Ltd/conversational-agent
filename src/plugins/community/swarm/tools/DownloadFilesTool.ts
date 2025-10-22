import { Bee, MantarayNode } from "@ethersphere/bee-js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { BaseHederaQueryTool, GenericPluginContext, HederaAgentKit } from "hedera-agent-kit";
import { promisify } from "util";
import { ToolResponse } from "../utils";

const DownloadFilesSchema = z.object({
  reference: z.string(),
  filePath: z.string().optional()
});

export class DownloadFilesTool extends BaseHederaQueryTool<typeof DownloadFilesSchema> {
  name = "swarm-download-files";
  description = "Download folder, files from a Swarm reference.";
  namespace = "swarm";
  specificInputSchema = DownloadFilesSchema;
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
      input: z.infer<typeof DownloadFilesSchema>
  ): Promise<ToolResponse | string> {
    const { reference, filePath } = input;
    
    if (!reference) {
      return "Missing required parameter: reference";
    }
    
    // if (filePath && !(transport instanceof StdioServerTransport)) {
    //   throw new McpError(
    //     ErrorCode.InvalidParams,
    //     "Saving to file path is only supported in stdio mode"
    //   );
    // }

    
    this.logger.info(`[API] Downloading folder from Swarm with reference: ${reference}.`);

    // Check if the reference is a manifest
    let isManifest = false;
    let node: MantarayNode;

    try {
      node = await MantarayNode.unmarshal(this.bee, reference);
      await node.loadRecursively(this.bee);
      isManifest = true;
    } catch (error) {
      // ignore
    }

    if (isManifest) {
      if (filePath) {
        const destinationFolder = filePath;

        if (!fs.existsSync(destinationFolder)) {
          await promisify(fs.mkdir)(destinationFolder, { recursive: true });
        }

        const nodes = node!.collect();

        if (nodes.length === 1) {
          const node = nodes[0];
          const data = await this.bee.downloadData(node.targetAddress);
          await promisify(fs.writeFile)(
            path.join(
              destinationFolder,
              node.fullPathString.split("\\").slice(-1)[0]
            ),
            data.toUint8Array()
          );
        } else {
          // Download each node
          for (const node of nodes) {
            const parsedPath = path.parse(node.fullPathString);
            const nodeDestFolder = path.join(destinationFolder, parsedPath.dir);
            // Create subdirectories if necessary
            if (!fs.existsSync(nodeDestFolder)) {
              await promisify(fs.mkdir)(nodeDestFolder, { recursive: true });
            }

            const data = await this.bee.downloadData(node.targetAddress);
            await promisify(fs.writeFile)(
              path.join(destinationFolder, node.fullPathString),
              data.toUint8Array()
            );
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  reference: reference,
                  manifestNodeCount: nodes.length,
                  savedTo: destinationFolder,
                  message: `Manifest content (${nodes.length} files) successfully downloaded to ${destinationFolder}`,
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        // regular file
        const nodes = node!.collect();
        const filesList = nodes.map((node) => ({
          path: node.fullPathString || "/",
          targetAddress: Array.from(node.targetAddress)
            .map((e) => e.toString(16).padStart(2, "0"))
            .join(""),
          metadata: node.metadata,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  reference: reference,
                  type: "manifest",
                  files: filesList,
                  message:
                    "This is a manifest with multiple files. Provide a filePath to download all files or download individual files using their specific references.",
                },
                null,
                2
              ),
            },
          ],
        };
      }
    } else {
      return "Try download_data tool instead since the given reference is not a manifest.";
    }
  }
}
