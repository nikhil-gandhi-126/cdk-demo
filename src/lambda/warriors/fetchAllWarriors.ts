import { Context, Handler } from 'aws-lambda';
import { s3Client, GetObjectCommand } from "../../../lib/s3Client";
import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

export const handler: Handler = async (event: SQSEvent, context: Context) => {
    return await fetchAllWarriors(event, context)
};
interface IWarrior {
    name: string;
    warriorId: string;
    fightsWon: string,
    fightsLoss: string
}
async function fetchAllWarriors(event: SQSEvent, context: Context) {

    try {
        console.log("SQS trigger fired")
        // console.log(JSON.stringify(event));
        // console.log(JSON.stringify(context));
        if (event && !event.Records) {
            return {
                statusCode: 404,
                body: JSON.stringify({}),
            };
        } else {
            const recordsBody = JSON.parse(event.Records[0].body)
            const bucketParams = {
                Bucket: recordsBody.Records[0].s3.bucket.name,
                Key: recordsBody.Records[0].s3.object.key
            }
            // Get the object from the Amazon S3 bucket. It is returned as a ReadableStream.
            const data = await s3Client.send(new GetObjectCommand(bucketParams));
            // Convert the ReadableStream to a string.
            if (data && data.Body) {
                const warriorData = await data.Body.transformToString();
                const parsedWarriorData: IWarrior[] = JSON.parse(warriorData)
                console.log({ warriorData })
                const ddbClient = new DynamoDBClient({ region: 'ap-south-1' });
                // const params = {
                //     TableName: "todo",
                //     Item: {
                //         id: { N: "1" },
                //         name: { S: "Richard Roe" },
                //         fightsWon: { N: "235" },
                //         fightsLoss: { N: "10" }
                //     }
                // };
                for (const warrior of parsedWarriorData) {

                    const warriorParams = marshall({
                        id: Number(warrior.warriorId),
                        name: warrior.name,
                        fightsWon: Number(warrior.fightsWon),
                        fightsLoss: Number(warrior.fightsLoss)
                    })
                    console.log({ warriorParams })
                    const params = {
                        TableName: "todo",
                        Item: warriorParams
                    };
                    await ddbClient.send(new PutItemCommand(params));
                }
                return {
                    statusCode: 200,
                    body: warriorData
                };
            } else {
                return {
                    statusCode: 200,
                    body: JSON.stringify({})
                };
            }
        }
    } catch (err) {
        console.log("Error==>", err);
        return err
    }
};
