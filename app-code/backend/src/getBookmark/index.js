import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamodb = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamodb);

export const handler = async message => {
  console.log(message);
  let bookmarkId = message.pathParameters.id
  let params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      id: bookmarkId
    }
  };

  console.log(`Getting bookmark ${bookmarkId} from table ${process.env.TABLE_NAME}`);
  let results = await docClient.send(new GetCommand(params));
  console.log(`Done: ${JSON.stringify(results)}`);

  return {
    statusCode: 200,
    headers: {"Access-Control-Allow-Origin": '*'},
    body: JSON.stringify(results.Item)
  };
}
