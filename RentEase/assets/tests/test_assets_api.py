import pytest

from assets.models import Asset, Category


@pytest.mark.django_db
def test_categories_requires_auth(api_client):
    res = api_client.get("/api/categories/")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_categories_returns_list(auth_client):
    Category.objects.create(name="Tools")
    Category.objects.create(name="Electronics")

    res = auth_client.get("/api/categories/")
    assert res.status_code == 200
    assert isinstance(res.data, list)
    assert len(res.data) == 2


@pytest.mark.django_db
def test_assets_list_filters_by_panchayat_and_excludes_owner(
    auth_client, user, user_profile, other_user, other_user_profile, panchayat
):
    category = Category.objects.create(name="Tools")

    Asset.objects.create(
        owner=other_user,
        category=category,
        title="Drill Machine",
        description="A powerful drill",
        city=panchayat,
        price_per_day="100.00",
        deposit="0.00",
    )
    Asset.objects.create(
        owner=user,
        category=category,
        title="My Own Item",
        description="Should be excluded",
        city=panchayat,
        price_per_day="50.00",
        deposit="0.00",
    )

    res = auth_client.get("/api/assets/")
    assert res.status_code == 200
    titles = [a["title"] for a in res.data]
    assert "Drill Machine" in titles
    assert "My Own Item" not in titles


@pytest.mark.django_db
def test_assets_search_by_title(
    auth_client, user_profile, other_user, other_user_profile, panchayat
):
    category = Category.objects.create(name="Tools")

    Asset.objects.create(
        owner=other_user,
        category=category,
        title="Ladder",
        description="Aluminium ladder",
        city=panchayat,
        price_per_day="40.00",
        deposit="0.00",
    )
    Asset.objects.create(
        owner=other_user,
        category=category,
        title="Hammer",
        description="Steel hammer",
        city=panchayat,
        price_per_day="10.00",
        deposit="0.00",
    )

    res = auth_client.get("/api/assets/?search=ham")
    assert res.status_code == 200
    titles = [a["title"] for a in res.data]
    assert titles == ["Hammer"]
