# A simple Serverless demo with crud operations

This app is to create a simple serverless based app which will cover crud operations.

**Services used:**

- **Amazon API Gateway:** It will have GET, POST, UPDATE and DELETE operations.
- **AWS Lambda:** Total 5 lambda functions (create, update, get, delete, list) used.
- **Amazon DynamoDB:** A table to store the bookmarks.

The Bookmark application is built based on Serverless
Application Model (SAM) framework, you can find the anatomy of the architecture in the template.yaml file.

**Initial setup**

You will need AWS SAM setup before proceed. Visit the page https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install-mac.html for settings.

Clone the source code and run the below command.

```
sam deploy --guided
```

**How to use the APIs**

Set a `API_END_POINT` with the following command.

```
export API_END_POINT=api_gateway_url

# e.g. export API_END_POINT=https://zzzxxxyyyhsg.execute-api.us-east-2.amazonaws.com/Dev

```

**Create a Bookmark:**

```
curl --header "Content-Type: application/json" \
--request POST \
--data '{"id": "uid001", "url": "https://www.aws.training/", "name": "AWS Training Page", "description": "This site carries tons of free AWS training courses"}' \
${API_END_POINT}/bookmarks
```

```
curl --header "Content-Type: application/json" \
--request POST \
--data '{"id": "uid002", "url": "https://apod.nasa.gov/apod/astropix.html", "name": "Astronomy Picture of the Day", "description": "Each day a different image."}' \
${API_END_POINT}/bookmarks
```

**List all Bookmarks:**

```
curl ${API_END_POINT}/bookmarks
```

**Get a Bookmark:**

```
curl ${API_END_POINT}/bookmarks/uid001
```

**Update a Bookmark:**

```
curl --header "Content-Type: application/json" \
--request PUT \
--data '{"id": "uid001", "url": "https://www.aws.training/", "name": "AWS Training Page and free digital courses", "description": "This site carries lots of useful courses on various AWS services"}' \
${API_END_POINT}/bookmarks/uid001
```

**Delete a Bookmark:**

```
curl --request DELETE ${API_END_POINT}/bookmarks/uid001
```

**Load test script**

```
for i in $(seq 1 100); do
    echo "Record no - $i" 
    export id=uid-$i
    curl --header "Content-Type: application/json" --request POST --data '{"id": "'$id'", "url": "https://en.wikipedia.org/'$i'", "name": "Wiki page '$i'", "description": "This is wiki page for non-english readers"}' ${API_END_POINT}/bookmarks; 
    sleep 0;
done
```
