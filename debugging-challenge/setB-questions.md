# IEEE Inter-Society Code Debugging Challenge — SET B Questions

> **Instructions:** Each program below has bugs. Fix them so the program gives the correct output for all test cases. Use the language given and keep the original structure. The bug count is a hint.
>
> Easy = 20 pts · Moderate = 50 pts · Hard = 100 pts · Total = 18×20 + 4×50 + 3×100 = **860**

---

# PART A — EASY (18 × 20 pts)

## E1. Sum of Sensor Readings · Python · IEEE CIS · AI&DS · 2 bugs
**Concept:** Accumulator pattern, loop ranges.
Print the sum of `n` integers.
**Input:** `n`, then n integers  **Sample:** `3` / `5 10 20` → `35`
```python
n = int(input())
a = list(map(int, input().split()))
total = 1
for i in range(1, n):
    total += a[i]
print(total)
```

## E2. Peak Voltage · C++ · Signal Processing Society · ECE · 2 bugs
**Concept:** Finding the maximum, choosing a safe initial value.
Print the largest of `n` readings (they may be negative).
**Input:** `n`, then n integers  **Sample:** `3` / `-5 -2 -9` → `-2`
```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    int mx = 0;
    for (int i = 0; i < n; i++) {
        int x; cin >> x;
        if (x < mx) mx = x;
    }
    cout << mx << endl;
}
```

## E3. Factorial · Java · Computer Society · CSE · 2 bugs
**Concept:** Loop bounds, integer overflow (int vs long).
Print n! (0 ≤ n ≤ 20).
**Input:** `n`  **Sample:** `5` → `120`
```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        int n = new Scanner(System.in).nextInt();
        int f = 1;
        for (int i = 1; i < n; i++) f *= i;
        System.out.println(f);
    }
}
```

## E4. Even and Odd Counter · Python · Computer Society · CSE · 1 bug
**Concept:** The modulo operator, conditions.
Print the number of even values and the number of odd values.
**Input:** `n`, then n integers  **Sample:** `5` / `1 2 3 4 6` → `3 2`
```python
n = int(input())
a = list(map(int, input().split()))
even = odd = 0
for x in a:
    if x % 2 == 1:
        even += 1
    else:
        odd += 1
print(even, odd)
```

## E5. Reverse a Signal Label · C++ · Computer Society · CSE · 2 bugs
**Concept:** Two-pointer swapping, 0-based indexing.
Reverse a string in place.
**Input:** one word  **Sample:** `hello` → `olleh`
```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    string s; cin >> s;
    int n = s.size();
    for (int i = 0; i < n; i++)
        swap(s[i], s[n - i]);
    cout << s << endl;
}
```

## E6. Temperature Converter · Java · Circuits & Systems · ECE · 1 bug
**Concept:** Integer division vs floating-point division.
Convert Celsius to Fahrenheit (`F = C × 9/5 + 32`) and print it with 1 decimal.
**Input:** integer C  **Sample:** `37` → `98.6`
```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        int c = new Scanner(System.in).nextInt();
        double f = c * (9 / 5) + 32;
        System.out.printf("%.1f%n", f);
    }
}
```

## E7. Vowel Counter · Python · IEEE CIS · AI&DS · 2 bugs
**Concept:** String traversal, case handling, `+=` vs `=+`.
Count the vowels in a line, in either case.
**Input:** one line  **Sample:** `IEEE Society` → `7`
```python
s = input()
count = 0
for ch in s:
    if ch in "aeiou":
        count =+ 1
print(count)
```

## E8. Digit Sum · C++ · Computer Society · CSE · 1 bug
**Concept:** Extracting digits with `% 10` and `/ 10`.
Print the sum of the digits of n.
**Input:** n (0 ≤ n ≤ 10¹⁸)  **Sample:** `1234` → `10`
```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    long long n; cin >> n;
    int s = 0;
    while (n > 0) {
        s += n / 10;
        n %= 10;
    }
    cout << s << endl;
}
```

## E9. Prime Check · Java · Security · Cyber · 2 bugs
**Concept:** Trial division up to √n, edge cases.
Print `PRIME` or `NOT PRIME`.
**Input:** n (0 ≤ n ≤ 10⁹)  **Sample:** `7` → `PRIME`, `1` → `NOT PRIME`
```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        int n = new Scanner(System.in).nextInt();
        boolean p = true;
        for (int i = 1; (long) i * i <= n; i++)
            if (n % i == 0) p = false;
        System.out.println(p ? "PRIME" : "NOT PRIME");
    }
}
```

## E10. Ohm's Law Calculator · Python · Circuits & Systems · ECE/VLSI · 2 bugs
**Concept:** Type conversion of input, Ohm's law (I = V/R, P = V×I).
Given voltage V and resistance R, print current I and power P with 2 decimals.
**Input:** `V R`  **Sample:** `12 4` → `3.00 36.00`
```python
V, R = input().split()
I = V / R
P = V * R
print(f"{I:.2f} {P:.2f}")
```

## E11. Count the 1-bits · C++ · Circuits & Systems · VLSI · 1 bug
**Concept:** Binary representation, LSB checking.
Print the number of 1s in the binary form of n.
**Input:** n (0 ≤ n ≤ 10⁹)  **Sample:** `13` → `3`
```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    int c = 0;
    while (n > 0) {
        if (n % 2 == 0) c++;
        n /= 2;
    }
    cout << c << endl;
}
```

## E12. Average Marks · Java · Computer Society · CSE · 2 bugs
**Concept:** Array bounds, integer vs double division.
Print the average of n marks with 2 decimals.
**Input:** `n`, then n integers  **Sample:** `3` / `1 2 2` → `1.67`
```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int sum = 0;
        for (int i = 0; i <= n; i++) sum += sc.nextInt();
        double avg = sum / n;
        System.out.printf("%.2f%n", avg);
    }
}
```

## E13. Linear Search · Python · Computer Society · CSE · 1 bug
**Concept:** Where to place `return` inside a loop.
Print the 0-based index of the first occurrence of t, or -1.
**Input:** `n t`, then n integers  **Sample:** `5 7` / `3 9 7 1 7` → `2`
```python
n, t = map(int, input().split())
a = list(map(int, input().split()))
def find(a, t):
    for i in range(len(a)):
        if a[i] == t:
            return i
        else:
            return -1
print(find(a, t))
```

## E14. GCD of Two Numbers · C++ · Security · Cyber · 1 bug
**Concept:** Euclid's algorithm, swapping with a temporary variable.
Print gcd(a, b).
**Input:** `a b` (1 ≤ a, b ≤ 10¹⁸)  **Sample:** `12 18` → `6`
```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    long long a, b; cin >> a >> b;
    while (b != 0) {
        a = b;
        b = a % b;
    }
    cout << a << endl;
}
```

## E15. Word Counter · Java · IEEE CIS · AI&DS · 2 bugs
**Concept:** String splitting with regular expressions, trimming spaces.
Count the words in a line. Words may be separated by several spaces, and the line may have leading or trailing spaces. There is at least one word.
**Input:** one line  **Sample:** `  IEEE   Computational Intelligence  ` → `3`
```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        String s = new Scanner(System.in).nextLine();
        String[] w = s.split(" ");
        System.out.println(w.length);
    }
}
```

## E16. Atbash Cipher · Python · Security · Cyber · 2 bugs
**Concept:** Character codes (`ord`/`chr`), substitution ciphers.
Replace each lowercase letter by its mirror (a↔z, b↔y, …). Keep spaces unchanged.
**Input:** lowercase text  **Sample:** `ieee cis` → `rvvv xrh`
```python
s = input().strip()
res = ""
for c in s:
    if c.isalpha():
        res = chr(ord('z') - ord(c))
    else:
        res += c
print(res)
```

## E17. Binary to Decimal · C++ · Circuits & Systems · VLSI · 2 bugs
**Concept:** Positional number systems, char-to-digit conversion.
Convert a binary string to decimal.
**Input:** binary string (length ≤ 60)  **Sample:** `1010` → `10`
```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    string s; cin >> s;
    long long r = 0;
    for (int i = 1; i < (int)s.size(); i++)
        r = r * 2 + s[i];
    cout << r << endl;
}
```

## E18. Leap Year · Java · Computer Society · CSE · 1 bug
**Concept:** Operator precedence of `&&` and `||`, compound conditions.
A year is a leap year if it is divisible by 400, or if it is divisible by 4 but not by 100. Print `LEAP` or `NOT LEAP`.
**Input:** year  **Sample:** `1900` → `NOT LEAP`, `2024` → `LEAP`
```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        int y = new Scanner(System.in).nextInt();
        if (y % 4 == 0 || y % 100 != 0 && y % 400 == 0)
            System.out.println("LEAP");
        else
            System.out.println("NOT LEAP");
    }
}
```

---

# PART B — MODERATE (4 × 50 pts)

## BM1. Second Highest Score · Python · Computer Society · CSE · 4 bugs
**Concept:** Tracking the top two values in one pass, sentinel values.
Print the second largest **distinct** value, or `-1` if there isn't one. Values can be negative.
**Input:** `n`, then n integers  **Sample:** `5` / `4 9 9 2 7` → `7`
```python
n = int(input())
a = list(map(int, input().split()))
first = second = 0
for x in a:
    if x > first:
        first = x
        second = first
    elif x > second:
        second = x
print(second)
```

## BM2. Bubble Sort · C++ · Computer Society · CSE · 3 bugs
**Concept:** Bubble sort passes, swapping, early termination.
Sort the array ascending.
**Input:** `n`, then n integers  **Sample:** `5` / `5 1 4 2 8` → `1 2 4 5 8`
```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    vector<int> a(n);
    for (auto &v : a) cin >> v;
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;
        for (int j = 0; j < n - i; j++)
            if (a[j] > a[j + 1]) {
                a[j] = a[j + 1];
                a[j + 1] = a[j];
                swapped = true;
            }
        if (swapped) break;
    }
    for (int i = 0; i < n; i++) cout << a[i] << " \n"[i == n - 1];
}
```

## BM3. Anagram Checker · Java · Security · Cyber · 3 bugs
**Concept:** Frequency counting with arrays.
Print `YES` if the two lowercase words are anagrams, otherwise `NO`.
**Input:** two words  **Sample:** `listen silent` → `YES`
```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String a = sc.next(), b = sc.next();
        int[] cnt = new int[25];
        for (char c : a.toCharArray()) cnt[c - 'a']++;
        for (char c : b.toCharArray()) cnt[c - 'a']++;
        boolean ok = true;
        for (int x : cnt)
            if (x != 0) ok = false;
            else ok = true;
        System.out.println(ok ? "YES" : "NO");
    }
}
```

## BM4. Run-Length Encoding · Python · Signal Processing Society · ECE · 3 bugs
**Concept:** Data compression, grouping consecutive characters, handling the last group.
Encode each run of characters as the character followed by its count.
**Input:** one non-empty string  **Sample:** `aaabccdd` → `a3b1c2d2`
```python
s = input().strip()
res = ""
count = 0
for i in range(1, len(s)):
    if s[i] == s[i - 1]:
        count += 1
    else:
        res += s[i - 1] + str(count)
        count = 0
print(res)
```

---

# PART C — HARD (3 × 100 pts)

## BH1. Counting Chip Islands (BFS on a Grid) · C++ · Circuits & Systems · VLSI/CSE · 3 bugs
**Concept:** Breadth-first search, grid traversal with direction arrays, visited marking.
In a grid of `0`s and `1`s, count the groups of `1`s connected up, down, left or right.
**Input:** `r c`, then r rows of a 0/1 string (r, c ≤ 1000)
**Sample:** `4 5` / `11000` / `11000` / `00100` / `00011` → `3`
```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    int r, c; cin >> r >> c;
    vector<string> g(r);
    for (auto &s : g) cin >> s;
    vector<vector<bool>> vis(r, vector<bool>(c, false));
    int dx[] = {1, -1, 0, 0}, dy[] = {0, 0, 1, 1};
    int cnt = 0;
    for (int i = 0; i < r; i++)
        for (int j = 0; j < c; j++)
            if (g[i][j] == '1' && !vis[i][j]) {
                cnt++;
                queue<pair<int,int>> q;
                q.push({i, j});
                while (!q.empty()) {
                    auto [x, y] = q.front(); q.pop();
                    vis[x][y] = true;
                    for (int d = 0; d < 4; d++) {
                        int nx = x + dx[d], ny = y + dy[d];
                        if (nx >= 0 && ny >= 0 && nx <= r && ny < c && g[nx][ny] == '1' && !vis[nx][ny])
                            q.push({nx, ny});
                    }
                }
            }
    cout << cnt << endl;
}
```

## BH2. Longest Unique-Character Key · Java · Security · Cyber · 3 bugs
**Concept:** Sliding window with two pointers, last-seen index table.
Print the length of the longest substring with no repeated character.
**Input:** one string of printable ASCII without spaces (length ≤ 10⁵)
**Sample:** `abcabcbb` → `3`, `abba` → `2`
```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        String s = new Scanner(System.in).next();
        int[] last = new int[128];
        int left = 0, best = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (last[c] >= 0) left = last[c] + 1;
            last[c] = i;
            best = Math.max(best, i - left);
        }
        System.out.println(best);
    }
}
```

## BH3. Resource Allocation (0/1 Knapsack) · Python · IEEE CIS · AI&DS · 3 bugs
**Concept:** Dynamic programming, 1-D knapsack with a reverse loop.
Choose items (each at most once) with total weight ≤ W and maximum total value.
**Input:** `n W`, then n lines `weight value`
**Sample:** `3 50` / `10 60` / `20 100` / `30 120` → `220`
```python
n, W = map(int, input().split())
items = [tuple(map(int, input().split())) for _ in range(n)]
dp = [0] * W
for v, w in items:
    for c in range(w, W + 1):
        dp[c] = max(dp[c], dp[c - w] + v)
print(dp[W])
```
