const validatePassword = (password) => {
  const passwordRegex =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
  return passwordRegex.test(password);
};

const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  if (!phone.startsWith("+")) {
    return false;
  }
  return { isValid: phoneRegex.test(phone), message: "" };
};

module.exports = {
  validatePassword,
  validateEmail,
  validatePhone,
};
