/** const axios = require('axios');
const crypto = require('crypto');
const { fromBuffer } = require('file-type');

async function aws(buffer, fn) {
    try {
        if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('Image buffer is required.');
        
        const { mime, ext } = await fromBuffer(buffer);
        const filename = fn ? fn.includes('.') ? fn : `${fn}.${ext}` : `${Date.now()}.${ext}`;
        
        const { data } = await axios.post('https://llamacoder.together.ai/api/s3-upload', {
            filename,
            filetype: mime,
            _nextS3: { strategy: 'aws-sdk' }
        });
        
        const { region, bucket, key } = data;
        const { AccessKeyId, SecretAccessKey, SessionToken } = data.token.Credentials;
        
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
        const dateStamp = amzDate.slice(0, 8);
        const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');
        const host = `${bucket}.s3.${region}.amazonaws.com`;
        
        const canonicalHeaders = `content-type:${mime}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\nx-amz-security-token:${SessionToken}\n`;
        const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token';
        const canonicalRequest = `PUT\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
        
        const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
        
        const signingKey = ['aws4_request', 's3', region, dateStamp].reduceRight((acc, val) => crypto.createHmac('sha256', acc).update(val).digest(), `AWS4${SecretAccessKey}`);
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
        const authorization = `AWS4-HMAC-SHA256 Credential=${AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
        
        await axios.put(`https://${host}/${key}`, buffer, {
            headers: {
                authorization: authorization,
                'content-type': mime,
                'x-amz-date': amzDate,
                'x-amz-content-sha256': payloadHash,
                'x-amz-security-token': SessionToken
            }
        });

        return `https://${host}/${key}`;
    } catch (error) {
        throw new Error(error.message);
    }
}
**/