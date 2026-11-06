[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/crypto/secrets](../README.md) / encryptSecret

# Function: encryptSecret()

> **encryptSecret**(`plaintext`): `string`

Defined in: [lib/crypto/secrets.ts:28](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/crypto/secrets.ts#L28)

AES-256-GCM encrypt; stored as base64(iv ‖ authTag ‖ ciphertext).

## Parameters

### plaintext

`string`

## Returns

`string`
