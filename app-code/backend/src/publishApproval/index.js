import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PublishCommand,SNSClient } from "@aws-sdk/client-sns";

const dynamodb = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamodb);

const snsClient = new SNSClient({});


export const handler = async message => {
  try {
   console.log(message);
   let bookmark = message;
   const emailSnsTopic = process.env.emailSnsTopic;
   const bookmarkDetails = JSON.stringify(bookmark);
   console.log("bookmarkDetails are "+bookmarkDetails);
   const bookmarkItem = JSON.parse(bookmarkDetails);
   console.log(bookmarkItem.detail.payload.id.S);
   if(message != null) 
    {
      var updateParams = {
      TableName: process.env.TABLE_NAME,
      Key:{
          "id": bookmarkItem.detail.payload.id.S
      },
      UpdateExpression: "set publish = :p",
      ExpressionAttributeValues:{
          ":p": "Approved"
      },
      ReturnValues:"UPDATED_NEW"
    };
    await docClient.send(new UpdateCommand(updateParams));
    console.log("UpdateItem succeeded:");

   }
  
  
  var params = {
    Message: "Publishing approved ",
    Subject: "Publishing email approval from AWS Step Functions",
    TopicArn: emailSnsTopic
  };
  
  await snsClient.send(new PublishCommand(params));
  console.log('Email sent to ' + emailSnsTopic);
}
catch (error) {
  console.log("Error occured:");
  throw new Error(JSON.stringify(error));
}

};
