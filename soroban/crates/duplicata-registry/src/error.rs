use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    IssuerNotAllowed = 4,
    InvalidAmounts = 5,
    InvalidDates = 6,
    FraudDeclarationsRequired = 7,
    NotFound = 8,
    InvalidDiscountFlags = 9,
}
