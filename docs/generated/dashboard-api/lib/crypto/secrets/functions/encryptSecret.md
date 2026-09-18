[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/crypto/secrets](../README.md) / encryptSecret

# Function: encryptSecret()

> **encryptSecret**(`plaintext`): `string`

Defined in: [lib/crypto/secrets.ts:28](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/crypto/secrets.ts#L28)

AES-256-GCM encrypt; stored as base64(iv ‖ authTag ‖ ciphertext).

## Parameters

### plaintext

`string`

## Returns

`string`
