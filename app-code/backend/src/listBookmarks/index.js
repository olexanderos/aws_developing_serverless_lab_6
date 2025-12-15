import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const dynamodb = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamodb);


export const handler = async message => {
  console.log(message);
  if (message.queryStringParameters != null)
  {
    let theuser = message.queryStringParameters.user
    console.log(`The user is: ${theuser}`)

    let params = {
      TableName: process.env.TABLE_NAME,
      IndexName: process.env.INDEX_NAME,
      KeyConditionExpression: "username = :keyname",
      ExpressionAttributeValues: {
        ":keyname": theuser
      }
    };
  
    console.log(`Getting all bookmarks from table ${process.env.TABLE_NAME}`);
    let results =  await docClient.send(new QueryCommand(params));
    console.log(`Done: ${JSON.stringify(results)}`);
  
    return {
      statusCode: 200,
      headers: {"Access-Control-Allow-Origin": '*'},
      body: JSON.stringify(results.Items)
    };
  }
}
