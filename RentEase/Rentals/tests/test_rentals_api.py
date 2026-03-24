import pytest

from assets.models import Asset, Category


@pytest.mark.django_db
def test_public_assets_list(api_client, other_user, panchayat):
    category = Category.objects.create(name="Tools")
    Asset.objects.create(
        owner=other_user,
        category=category,
        title="Public Asset",
        description="Desc",
        city=panchayat,
        price_per_day="10.00",
        deposit="0.00",
    )

    res = api_client.get("/api/rentals/assets/")
    assert res.status_code == 200
    assert isinstance(res.data, list)
    assert len(res.data) == 1


@pytest.mark.django_db
def test_public_asset_detail(api_client, other_user, panchayat):
    category = Category.objects.create(name="Tools")
    asset = Asset.objects.create(
        owner=other_user,
        category=category,
        title="Public Asset 2",
        description="Desc",
        city=panchayat,
        price_per_day="10.00",
        deposit="0.00",
    )

    res = api_client.get(f"/api/rentals/assets/{asset.id}/")
    assert res.status_code == 200
    assert res.data["id"] == asset.id
