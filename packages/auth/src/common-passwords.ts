/**
 * Bundled list for the "not a very common password" rule. It is a server side check, so a failed list load
 * can never block sign up (M01-S02 error case). Entries are lowercase.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  '1234567890', '0987654321', '1q2w3e4r5t', '1qaz2wsx3e', 'qwertyuiop', 'asdfghjkl1', 'zxcvbnm123',
  'qwerty1234', 'qwerty12345', 'qwertyuiop1', 'abcdefghij', 'abcd123456', 'abc1234567', 'iloveyou12',
  'iloveyou123', 'password12', 'password123', 'password1234', 'password12345', 'passw0rd123', 'p@ssw0rd12',
  'p@ssword123', 'letmein123', 'welcome123', 'welcome1234', 'admin12345', 'administrator', 'changeme123',
  'football123', 'baseball123', 'superman123', 'princess123', 'sunshine123', 'monkey1234', 'dragon1234',
  'master1234', 'shadow1234', 'trustno1234', 'whatever123', 'freedom123', 'nigeria123', 'nigeria1234',
  'nigerian123', 'lagos12345', 'abuja12345', 'naija12345', 'jesus12345', 'godisgood123', 'godislove12',
  'blessing123', 'blessed1234', 'angels12345', 'angelsdelight', 'angelsdelight1', 'angelsdelight123',
  'chelsea1234', 'arsenal1234', 'manutd1234', 'liverpool123', 'barcelona123', '0123456789', '9876543210',
  '1111111111', '0000000000', '1234512345', '123456789a', 'a123456789', 'a1234567890', '123456789q',
  'q1w2e3r4t5', 'qazwsxedc123', 'iloveyou1234', 'mypassword1', 'mypassword12', 'mypassword123',
  'letmein1234', 'login12345', 'default1234', 'secret1234', 'testing1234', 'test123456', 'test1234567',
]);

/** Words people extend with digits or symbols. A password that is only one of these plus a short tail is refused. */
export const COMMON_BASE_WORDS: ReadonlySet<string> = new Set([
  'password', 'passw0rd', 'p@ssword', 'p@ssw0rd', 'qwerty', 'qwertyuiop', 'letmein', 'welcome', 'iloveyou',
  'admin', 'administrator', 'changeme', 'football', 'baseball', 'superman', 'princess', 'sunshine', 'monkey',
  'dragon', 'master', 'shadow', 'whatever', 'freedom', 'nigeria', 'naija', 'lagos', 'abuja', 'jesus',
  'blessing', 'blessed', 'angels', 'chelsea', 'arsenal', 'liverpool', 'abcdefgh', 'mypassword',
]);
