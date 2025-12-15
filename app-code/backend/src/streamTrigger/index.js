import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"; 
const client = new EventBridgeClient({});

export const handler = async (event) => {
    console.log(JSON.stringify(event, null, 2));
    try
    {
        for(let i=0; i< event.Records.length; i++) {
            const record = event.Records[i]
            console.log(record.eventID);
            console.log(record.eventName);
            if(record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
            console.log('DynamoDB Record: %j', record.dynamodb);  
                console.log('share flag:', record.dynamodb.NewImage.shared.BOOL);
                
                var pk = record.dynamodb.NewImage.id.S;
                var sharedFlag = record.dynamodb.NewImage.shared.BOOL;
                
                const bookmarkDetails = {
                    id: pk,
                    shared: sharedFlag,
                    payload: record.dynamodb.NewImage
                }
                
                const params = {
                Entries: [
                {
                    Source: 'DynamoDB Streams',
                    DetailType: 'Shared Bookmarks',
                    EventBusName: 'bookmarks-bus',
                    Detail: JSON.stringify(bookmarkDetails)
                }        
                ]
            };
            const put_command = new PutEventsCommand(params)
            const response = await client.send(put_command);
            console.log("response:", response);
            //We can optimize the code by calling the putEvents outside of the loop with promise all option. where all the records
            //will put in the bus in parallel. 
            }
        }
    } catch (error) {
        throw new Error(JSON.stringify(error));
    }
}
