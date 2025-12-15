import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamodb = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamodb);

export const handler = async message => {
   console.log(message);
   let bookmark = message;
   const bookmarkDetails = JSON.stringify(bookmark);
   console.log("bookmarkDetails are "+bookmarkDetails);
   const bookmarkItem = JSON.parse(bookmarkDetails);
   console.log("bookmarkItem "+bookmarkItem);
   console.log("url is "+bookmarkItem.detail.payload.bookmarkUrl.S);
   var exists = false;
   try{
       if(message != null) 
        {
            var params = {
              TableName: process.env.TABLE_NAME,
              IndexName: process.env.INDEX_NAME,
              KeyConditionExpression: "bookmarkUrl = :keyurl",
              ExpressionAttributeValues: {
               ":keyurl": bookmarkItem.detail.payload.bookmarkUrl.S
              }
            };
           console.log("exists "+exists);
           var result = await docClient.send(new QueryCommand(params))
           console.log("result is "+JSON.stringify(result.Items));
           var data = JSON.parse(JSON.stringify(result.Items));

            data.forEach(function(item) {
                console.log("db username", item.username.S+" "+bookmarkItem.detail.payload.username.S);
                if (item.username.S != bookmarkItem.detail.payload.username.S)
                    exists = true;
                });

            console.log(exists);
            if (exists === true)
            {
              console.log("in here");    
              var updateParams = {
              TableName: process.env.TABLE_NAME,
              Key:{
                  "id": bookmarkItem.detail.payload.id.S
              },
              UpdateExpression: "set contest=:c",
              ExpressionAttributeValues:{
                  ":c": "duplicate"
              },
              ReturnValues:"UPDATED_NEW"
            };
            await docClient.send(new UpdateCommand(updateParams), function(err, data) {
              if (err) {
                console.log("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
              }
              else {
                console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
              }
            });
            return "Duplicate";
            }
        }
    }

   catch(e){
     console.log(e);
   }
    return "NotDuplicate";
};