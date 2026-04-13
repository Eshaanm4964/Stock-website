from datetime import datetime

from pydantic import BaseModel, Field


class AdminDashboardResponse(BaseModel):
    total_users: int
    newly_registered_users: int
    total_notifications: int
    total_holdings: int


class AdminUserSummary(BaseModel):
    user_id: int
    username: str
    fixed_user_id: str | None
    full_name: str
    phone_number: str
    role: str
    is_active: bool
    is_demo: bool
    created_at: datetime
    portfolio_value: float
    total_holdings: int


class AdminHoldingSnapshot(BaseModel):
    holding_id: int
    symbol: str
    quantity: float
    buy_price: float
    current_price: float
    value: float
    profit_loss: float
    percent_change: float
    sector: str | None
    exchange: str | None = None
    created_at: datetime | None = None


class AdminSaleSnapshot(BaseModel):
    sale_id: int
    symbol: str
    quantity: float
    buy_price: float
    sell_price: float
    profit_loss: float
    sector: str | None
    exchange: str | None = None
    sold_at: datetime | None = None


class AdminUserDashboardResponse(BaseModel):
    user_id: int
    username: str
    fixed_user_id: str | None
    full_name: str
    phone_number: str
    total_portfolio_value: float
    total_profit_loss: float
    booked_profit_loss: float = 0.0
    lifetime_profit_loss: float = 0.0
    total_holdings: int
    holdings: list[AdminHoldingSnapshot]
    sales: list[AdminSaleSnapshot] = []


class AdminAuditLogResponse(BaseModel):
    id: int
    admin_user_id: int
    action: str
    entity_type: str
    entity_id: str | None
    ip_address: str | None
    details_json: str | None
    created_at: datetime


class AuthAttemptResponse(BaseModel):
    id: int
    user_id: int | None
    role: str
    stage: str
    identifier: str
    phone_number: str | None
    ip_address: str | None
    success: bool
    failure_reason: str | None
    metadata_json: str | None
    created_at: datetime


class AdminUserStatusUpdateRequest(BaseModel):
    is_active: bool


class AdminDealCreateRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    quantity: float = Field(gt=0)
    buy_price: float = Field(gt=0)
    exchange: str = Field(default="NSE", min_length=2, max_length=10)


class AdminBulkUserActionRequest(BaseModel):
    action: str
    user_ids: list[int]


class AdminBulkUserActionResponse(BaseModel):
    action: str
    processed_count: int
    skipped_count: int
    user_ids: list[int]


class AdminSystemStatusResponse(BaseModel):
    backend_status: str
    database_status: str
    redis_status: str
    environment: str
    otp_debug_mode: bool
    total_admin_logs: int
    total_auth_attempts: int


class AdminPortfolioOverviewResponse(BaseModel):
    dashboard: AdminDashboardResponse
    users: list[AdminUserSummary]
    system_status: AdminSystemStatusResponse
    user_dashboards: list[AdminUserDashboardResponse]


class AdminStockConcentrationItem(BaseModel):
    symbol: str
    client_count: int
    total_quantity: float
    invested_value: float


class AdminLoginIssueItem(BaseModel):
    reason: str
    count: int


class AdminUserActivityItem(BaseModel):
    user_id: int
    full_name: str
    fixed_user_id: str | None
    is_active: bool
    holding_count: int
    last_holding_at: datetime | None
    last_auth_attempt_at: datetime | None


class AdminSettingsOverview(BaseModel):
    show_faq_insights: bool
    chat_nudges_enabled: bool
    otp_debug_mode: bool
    auth_rate_limit_window_minutes: int
    auth_max_failed_attempts: int


class AdminOperationsOverviewResponse(BaseModel):
    active_users: int
    inactive_users: int
    users_with_holdings: int
    average_portfolio_value: float
    largest_client_value: float
    stock_concentration: list[AdminStockConcentrationItem]
    login_issue_breakdown: list[AdminLoginIssueItem]
    recent_user_activity: list[AdminUserActivityItem]
    settings_overview: AdminSettingsOverview
