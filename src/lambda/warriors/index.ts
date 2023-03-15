import { Handler } from 'aws-lambda';
import { s3Client, PutObjectCommand } from "../../../lib/s3Client";

export const handler: Handler = async (event, context) => {
    return await createWarrior()
};

async function createWarrior() {

    const warriorsObj = [
        { warriorId: 1, name: 'Kane', fightsWon: 20, fightsLoss: 5 },
        { warriorId: 2, name: 'Rock', fightsWon: 50, fightsLoss: 10 },
        { warriorId: 3, name: 'John', fightsWon: 30, fightsLoss: 15 },
        { warriorId: 4, name: 'Alberto', fightsWon: 10, fightsLoss: 20 },
        { warriorId: 5, name: 'Orton', fightsWon: 17, fightsLoss: 7 }
    ];

    const bufferData = Buffer.from(JSON.stringify(warriorsObj));

    // Set the parameters.
    const bucketParams = {
        Bucket: "acolyte-warriors",
        Key: "ACOLYTE_WARRIORS",
        Body: bufferData,
        ContentEncoding: 'base64',
        ContentType: 'application/json',
        ACL: 'public-read'
    };
    try {
        const data = await s3Client.send(new PutObjectCommand(bucketParams));
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (err) {
        console.log("Error", err);
        return err
    }
};
