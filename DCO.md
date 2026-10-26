# Developer Certificate of Origin

Rivet uses Developer Certificate of Origin version 1.1.

By adding this line to a commit:

```text
Signed-off-by: Contributor Name <contributor@example.com>
```

the contributor certifies that the contribution satisfies the Developer
Certificate of Origin version 1.1 published by the Linux Foundation:

<https://developercertificate.org/>

Use your real contribution identity. The sign-off name and email must match
the commit author name and email.

Add the sign-off with:

```sh
git commit --signoff
```

The required CI checks reject a pull-request commit without a matching
sign-off. A maintainer must not bypass this check.
