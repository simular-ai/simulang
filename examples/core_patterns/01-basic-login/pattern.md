# Basic Login

![Category](https://img.shields.io/badge/category-authentication-blue)
![Difficulty](https://img.shields.io/badge/difficulty-beginner-green)
![Tags](https://img.shields.io/badge/tags-login%20%7C%20form%20%7C%20credentials%20%7C%20ax--tree-lightgrey)

Navigate to a public login test page, fill credentials using the accessibility tree, submit the form, and verify success with visual grounding.

## Context

|                    |                                                         |
| ------------------ | ------------------------------------------------------- |
| **URL**            | https://practicetestautomation.com/practice-test-login/ |
| **App**            | Practice Test Automation — Login (web, no auth)         |
| **Browser state**  | Logged out                                              |
| **Prerequisites**  | macOS Accessibility permission granted for the browser  |
| **Credentials**    | `student` / `Password123`                               |
| **Reversible**     | No                                                      |
| **Requires human** | No                                                      |

## How it works

1. Open `https://practicetestautomation.com/practice-test-login/` in the default browser; wait ~3 seconds for the page to render.
2. Locate the **Username** field via the AX tree (`AriaRole.Textbox` named "Username") and type the username.
3. Locate the **Password** field the same way and type the password.
4. Locate the **Submit** button (`AriaRole.Button` named "Submit") and activate it.
5. Wait ~2 seconds for navigation to complete.
6. Take a screenshot and ground for a logged-in dashboard element to confirm success.

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

After submit, the page navigates to a "Logged In Successfully" view.

## Potential Pitfalls

- Wrong password error message displayed
- Page not loaded / network timeout
- Username/Password field labels differ from defaults — update `find()` name argument

## Related Examples

- `login-otp-2fa`
