"""S3 object storage.

Everything the browser sees is a presigned GET. The bucket has Block Public
Access on, so an object URL on its own is useless without a signature.
"""

import uuid
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings


class StorageError(Exception):
    pass


@lru_cache(maxsize=1)
def client():
    """One shared boto3 client.

    On EC2 there are no keys to pass: boto3 picks up the IAM instance role from
    the metadata service on its own. Locally it falls back to whatever is in
    the environment, or to MinIO when S3_ENDPOINT_URL is set.
    """
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        endpoint_url=settings.s3_endpoint_url or None,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )


def build_keys(entry_id: uuid.UUID, image_id: uuid.UUID, extension: str) -> dict[str, str]:
    """Object keys for one image, derived entirely from ids.

    Never build these from the uploaded filename: it would leak whatever the
    owner happened to call the file, and invites path traversal in the key.
    """
    prefix = f"entries/{entry_id}/{image_id}"
    return {
        "original": f"{prefix}/original{extension}",
        "medium": f"{prefix}/medium.webp",
        "thumb": f"{prefix}/thumb.webp",
    }


def put(key: str, data: bytes, content_type: str) -> None:
    try:
        client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    except ClientError as exc:
        raise StorageError(f"Could not upload {key}") from exc


def delete_many(keys: list[str]) -> None:
    """Remove objects, ignoring any that have already gone.

    Called on the delete path, where the database row is about to disappear
    regardless. Raising because an object was already missing would strand the
    row and make the problem permanent.
    """
    keys = [k for k in keys if k]
    if not keys:
        return
    try:
        client().delete_objects(
            Bucket=settings.s3_bucket,
            Delete={"Objects": [{"Key": k} for k in keys], "Quiet": True},
        )
    except ClientError as exc:
        raise StorageError("Could not delete objects") from exc


def presigned_url(key: str) -> str:
    """Time-limited GET URL for the browser.

    Expiry is presign_ttl_seconds (1h). The frontend's cache must expire
    sooner, or a tab left open will hold URLs S3 has stopped honouring.
    """
    return client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=settings.presign_ttl_seconds,
    )
