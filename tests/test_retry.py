"""
Retry Engine Calculation & Strategy Tests.
"""

from app.services.retry_service import calculate_next_retry_delay


def test_fixed_retry_delay():
    """Test fixed delay strategy always returns the constant initial_delay."""
    policy = {
        "strategy": "fixed",
        "initial_delay": 15,
        "max_delay": 60,
    }
    for attempt in range(1, 6):
        delay = calculate_next_retry_delay(policy, attempt=attempt)
        assert delay == 15.0


def test_linear_retry_delay():
    """Test linear delay strategy multiplies initial delay by attempt count."""
    policy = {
        "strategy": "linear",
        "initial_delay": 5,
        "max_delay": 50,
    }
    assert calculate_next_retry_delay(policy, attempt=1) == 5.0
    assert calculate_next_retry_delay(policy, attempt=2) == 10.0
    assert calculate_next_retry_delay(policy, attempt=3) == 15.0
    assert calculate_next_retry_delay(policy, attempt=15) == 50.0  # Capped at max_delay


def test_exponential_retry_delay_with_cap():
    """Test exponential backoff calculations without jitter."""
    policy = {
        "strategy": "exponential",
        "initial_delay": 2,
        "multiplier": 2.0,
        "max_delay": 30,
        "jitter": False,
    }
    # delay = 2 * (2 ^ (attempt - 1))
    assert calculate_next_retry_delay(policy, attempt=1) == 2.0
    assert calculate_next_retry_delay(policy, attempt=2) == 4.0
    assert calculate_next_retry_delay(policy, attempt=3) == 8.0
    assert calculate_next_retry_delay(policy, attempt=4) == 16.0
    assert calculate_next_retry_delay(policy, attempt=5) == 30.0  # Capped at max_delay


def test_exponential_retry_delay_with_jitter():
    """Test exponential backoff with full jitter is bounded within [0, base_delay]."""
    policy = {
        "strategy": "exponential",
        "initial_delay": 4,
        "multiplier": 2.0,
        "max_delay": 64,
        "jitter": True,
    }
    for attempt in range(1, 5):
        delay = calculate_next_retry_delay(policy, attempt=attempt)
        base = min(64.0, 4.0 * (2.0 ** (attempt - 1)))
        assert 0.0 <= delay <= base
