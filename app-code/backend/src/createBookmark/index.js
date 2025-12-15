import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamodb = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamodb);

export const handler = async message => {
  console.log(message);

  if (message.body) {
    let bookmark = JSON.parse(message.body);
    let params = {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: bookmark.id ,
        bookmarkUrl: bookmark.bookmarkUrl ,
        name: bookmark.name ,
        description: bookmark.description ,
        username: bookmark.username ,
        shared: bookmark.shared 
      }
    };
    
    
    console.log(`Adding bookmark to table ${process.env.TABLE_NAME}`);
    await docClient.send(new PutCommand(params));
    console.log(`New bookmark added to the inventory`);
  }

  return {
    statusCode: 200,
    headers: {"Access-Control-Allow-Origin": '*'},
    body: JSON.stringify({})
  };
}
