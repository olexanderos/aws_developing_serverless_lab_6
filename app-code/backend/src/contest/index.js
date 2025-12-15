import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const dynamodb = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamodb);

export const handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2));
    const Key = { id: event.detail.id };
    
    var params = {
      TableName: process.env.TABLE_NAME,
      Key:{
          "id": event.detail.id
      },
      UpdateExpression: "set contest = :p",
      ExpressionAttributeValues:{
          ":p":"Entered"
      },
      ReturnValues:"UPDATED_NEW"
    };
    
    console.log("Updating the item...", params);    

    let response = await docClient.send(new UpdateCommand(params));

    
    console.log("Response:", response);
}