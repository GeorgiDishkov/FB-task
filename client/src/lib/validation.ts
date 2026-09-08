import Joi from 'joi';

export const FIELD_MIN_LENGTH = 4;
export const FIELD_MAX_LENGTH = 30;

export interface LoginFormValues {
  username: string;
  password: string;
}

export type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

/**
 * Requirement: "neither the username nor the password fields are empty and include
 * between 4 to 30 characters."
 *
 * Note the deliberate asymmetry: `.trim()` on username, none on password. Trailing
 * whitespace in a username is always a paste artifact, and letting "bob " differ from
 * "bob" is a classic bug. In a password a space is a legitimate character, so trimming
 * would silently change what the user typed. See plan/FE/03-login-form.md.
 *
 * Joi's built-in messages quote the key ('"username" length must be at least 4
 * characters long'), so every rule we can hit gets its own copy. `string.empty` and
 * `any.required` both need one: '' triggers the first, a missing key the second.
 */
export const loginSchema = Joi.object<LoginFormValues, true>({
  username: Joi.string()
    .trim()
    .min(FIELD_MIN_LENGTH)
    .max(FIELD_MAX_LENGTH)
    .required()
    .messages({
      'string.base': 'Username is required.',
      'string.empty': 'Username is required.',
      'any.required': 'Username is required.',
      'string.min': `Username must be at least ${FIELD_MIN_LENGTH} characters.`,
      'string.max': `Username must be ${FIELD_MAX_LENGTH} characters or fewer.`,
    }),
  password: Joi.string()
    .min(FIELD_MIN_LENGTH)
    .max(FIELD_MAX_LENGTH)
    .required()
    .messages({
      'string.base': 'Password is required.',
      'string.empty': 'Password is required.',
      'any.required': 'Password is required.',
      'string.min': `Password must be at least ${FIELD_MIN_LENGTH} characters.`,
      'string.max': `Password must be ${FIELD_MAX_LENGTH} characters or fewer.`,
    }),
});

const isFieldName = (value: unknown): value is keyof LoginFormValues =>
  value === 'username' || value === 'password';

/**
 * Joi reports one detail per failed rule, so a field can appear more than once. We show
 * a single line per field, so the first message wins.
 */
const toFieldErrors = (error: Joi.ValidationError): LoginFormErrors =>
  error.details.reduce<LoginFormErrors>((collected, detail) => {
    const field = detail.path[0];

    if (!isFieldName(field) || collected[field] !== undefined) {
      return collected;
    }

    return { ...collected, [field]: detail.message };
  }, {});

/**
 * `abortEarly: false` is not optional here. Joi's default stops at the first failing
 * key, so a form with both fields empty would only ever report `username` — and the user
 * would fix errors one at a time while the button stayed disabled for no visible reason.
 */
export const validateLoginForm = (values: LoginFormValues): LoginFormErrors => {
  const result = loginSchema.validate(values, { abortEarly: false, convert: true });

  if (!result.error) {
    return {};
  }

  return toFieldErrors(result.error);
};

/** `abortEarly: true` — this only needs a yes/no, so stop at the first failure. */
export const isLoginFormValid = (values: LoginFormValues): boolean =>
  loginSchema.validate(values, { abortEarly: true }).error === undefined;
